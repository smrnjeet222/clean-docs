"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor as TiptapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "next/link";
import {
  useDocumentQuery,
  useUploadFile,
  useShareDocument,
  useRevokeShare,
  type DocumentDetail,
  type FileItem,
  type ShareRole,
} from "@/hooks/documents";
import { useDocumentSave } from "@/hooks/useDocumentSave";
import { htmlToMarkdown } from "@/lib/document-format";
import type { SaveStatus } from "@/lib/save-machine";

const POLL_MS = 5000;

export default function Editor({ initial }: { initial: DocumentDetail }) {
  const isCollaborative = initial.shares.length > 0 || initial.access !== "owner";
  const query = useDocumentQuery(initial.id, {
    initialData: initial,
    refetchInterval: isCollaborative ? POLL_MS : false,
    collaborative: isCollaborative,
  });
  const doc = query.data ?? initial;
  const access = doc.access;
  const canWrite = access === "owner" || access === "edit";

  const save = useDocumentSave(initial.id, initial.version);
  const [title, setTitle] = useState(initial.title);
  const applyingRemote = useRef(false);

  const editor = useEditor({
    extensions: [StarterKit],
    content: initial.contentHtml || "<p></p>",
    editable: canWrite,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "prose prose-neutral max-w-none min-h-[60vh] focus:outline-none" },
    },
    onUpdate: ({ editor }) => {
      if (applyingRemote.current) return;
      save.onEdit(editor.getHTML());
    },
  });

  function applyRemote(html: string) {
    if (!editor) return;
    applyingRemote.current = true;
    editor.commands.setContent(html);
    applyingRemote.current = false;
  }

  // Reconcile a newer remote version observed by polling.
  const remoteVersion = query.data?.version;
  const remoteHtml = query.data?.contentHtml;
  useEffect(() => {
    if (remoteVersion == null || remoteHtml == null) return;
    if (remoteVersion <= save.version) return; // nothing newer than what we hold
    if (save.status === "clean" || save.status === "saved") {
      applyRemote(remoteHtml); // safe: no local edits to lose
      save.setVersion(remoteVersion);
      save.send("remoteChanged");
    } else {
      save.send("remoteChanged"); // dirty/saving → conflict, surfaced as a banner
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteVersion, remoteHtml]);

  async function reloadRemote() {
    const fresh = await query.refetch();
    if (fresh.data) {
      applyRemote(fresh.data.contentHtml);
      save.setVersion(fresh.data.version);
      save.send("reload");
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1600px] px-8 py-8">
      <div className="mb-4 flex items-center justify-between text-sm">
        <Link href="/docs" className="text-neutral-600 underline">← All documents</Link>
        <div className="flex items-center gap-3">
          <ExportButtons editor={editor} title={title} />
          <span className="text-neutral-400">
            {access === "owner" && "You own this"}
            {access === "edit" && `Shared by ${doc.owner.name} · can edit`}
            {access === "view" && `Shared by ${doc.owner.name} · read-only`}
            {canWrite && <SaveBadge status={save.status} onRetry={save.retry} />}
          </span>
        </div>
      </div>

      {save.status === "conflict" && <ConflictBanner onReload={reloadRemote} />}

      <input
        value={title}
        onChange={(e) => { setTitle(e.target.value); save.saveTitle(e.target.value); }}
        disabled={!canWrite}
        className="mb-4 w-full border-none text-3xl font-bold text-neutral-900 focus:outline-none disabled:bg-transparent"
        placeholder="Untitled"
      />

      {canWrite && editor && <Toolbar editor={editor} disabled={save.status === "conflict"} />}

      <div className="rounded-lg border border-neutral-200 p-4">
        <EditorContent editor={editor} />
      </div>

      <FilesPanel docId={initial.id} files={doc.files} canWrite={canWrite} />

      {access === "owner" && <SharePanel docId={initial.id} shares={doc.shares} />}
    </main>
  );
}

function SaveBadge({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  return (
    <span className="ml-2">
      {(status === "clean" || status === "saved") && "✓ Saved"}
      {status === "dirty" && "Editing…"}
      {status === "saving" && "Saving…"}
      {status === "error" && (
        <button onClick={onRetry} className="text-red-600 underline">Save failed — retry</button>
      )}
      {status === "conflict" && <span className="text-amber-600">Out of date</span>}
    </span>
  );
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ExportButtons({ editor, title }: { editor: TiptapEditor | null; title: string }) {
  if (!editor) return null;
  const base = (title || "document").replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "") || "document";
  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => download(`${base}.md`, htmlToMarkdown(editor.getHTML()), "text/markdown")}
        className="rounded border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
      >
        Export .md
      </button>
      <button
        type="button"
        onClick={() => download(`${base}.txt`, editor.getText(), "text/plain")}
        className="rounded border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
      >
        Export .txt
      </button>
    </span>
  );
}

function ConflictBanner({ onReload }: { onReload: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <span>This document changed in another session. Editing is paused to avoid overwriting it.</span>
      <button onClick={onReload} className="rounded-md bg-amber-600 px-3 py-1.5 font-medium text-white hover:bg-amber-700">
        Reload latest
      </button>
    </div>
  );
}

function Btn({ active, disabled, onClick, children, title }: { active?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode; title: string }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`rounded px-2 py-1 text-sm font-medium disabled:opacity-40 ${active ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"}`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor, disabled }: { editor: TiptapEditor; disabled?: boolean }) {
  return (
    <div className="mb-2 flex flex-wrap gap-1">
      <Btn title="Bold" disabled={disabled} active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></Btn>
      <Btn title="Italic" disabled={disabled} active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></Btn>
      <Btn title="Underline" disabled={disabled} active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></Btn>
      <Btn title="Strikethrough" disabled={disabled} active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></Btn>
      <span className="mx-1 w-px bg-neutral-200" />
      <Btn title="Heading 1" disabled={disabled} active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</Btn>
      <Btn title="Heading 2" disabled={disabled} active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</Btn>
      <Btn title="Heading 3" disabled={disabled} active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</Btn>
      <span className="mx-1 w-px bg-neutral-200" />
      <Btn title="Bullet list" disabled={disabled} active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</Btn>
      <Btn title="Numbered list" disabled={disabled} active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</Btn>
    </div>
  );
}

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function FilesPanel({ docId, files, canWrite }: { docId: string; files: FileItem[]; canWrite: boolean }) {
  const upload = useUploadFile(docId);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await upload.mutateAsync(file);
    } finally {
      e.target.value = "";
    }
  }

  return (
    <section className="mt-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Attachments</h2>
      {canWrite && (
        <div className="mb-2">
          <input type="file" onChange={onUpload} disabled={upload.isPending} className="text-sm" />
          <p className="mt-1 text-xs text-neutral-400">
            Supported: PNG, JPG, GIF, WebP, PDF, TXT, Markdown, CSV — max 5 MB.
          </p>
          {upload.isError && <p className="text-sm text-red-600">{(upload.error as Error).message}</p>}
        </div>
      )}
      {files.length === 0 ? (
        <p className="text-sm text-neutral-400">No attachments.</p>
      ) : (
        <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                {f.filename}
              </a>
              <span className="text-xs text-neutral-400">{fmtSize(f.size)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SharePanel({ docId, shares }: { docId: string; shares: DocumentDetail["shares"] }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ShareRole>("EDIT");
  const share = useShareDocument(docId);
  const revoke = useRevokeShare(docId);

  async function grant(e: React.FormEvent) {
    e.preventDefault();
    try {
      await share.mutateAsync({ email, role });
      setEmail("");
    } catch {
      /* error surfaced below */
    }
  }

  return (
    <section className="mt-8 rounded-lg border border-neutral-200 p-4">
      <h2 className="mb-3 text-sm font-semibold text-neutral-900">Share this document</h2>
      <form onSubmit={grant} className="flex flex-wrap items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="person@example.com"
          required
          className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
        />
        <select value={role} onChange={(e) => setRole(e.target.value as ShareRole)} className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm">
          <option value="EDIT">Can edit</option>
          <option value="VIEW">Can view</option>
        </select>
        <button disabled={share.isPending} className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
          Share
        </button>
      </form>
      {share.isError && <p className="mt-2 text-sm text-red-600">{(share.error as Error).message}</p>}
      {shares.length > 0 && (
        <ul className="mt-3 space-y-1">
          {shares.map((s) => (
            <li key={s.user.email} className="flex items-center justify-between text-sm">
              <span className="text-neutral-700">
                {s.user.name} ({s.user.email}) · {s.role === "EDIT" ? "can edit" : "can view"}
              </span>
              <button onClick={() => revoke.mutate(s.user.email)} className="text-xs text-red-600 underline">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
