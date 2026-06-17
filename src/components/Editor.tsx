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
import { useDuplicateDocument, useDeleteDocument, useLeaveDocument } from "@/hooks/documents";
import { htmlToMarkdown, fileTextToHtml, formatForFilename } from "@/lib/document-format";
import type { SaveStatus } from "@/lib/save-machine";
import { useRouter } from "next/navigation";

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

  const router = useRouter();
  const duplicate = useDuplicateDocument();
  const remove = useDeleteDocument();
  const leave = useLeaveDocument();
  const actionBusy = duplicate.isPending || remove.isPending || leave.isPending;

  const importInput = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  async function onImportIntoDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !editor) return;
    setImportError(null);
    const format = formatForFilename(file.name);
    if (!format) { setImportError("Only .txt and .md files can be imported."); return; }
    try {
      const html = fileTextToHtml(await file.text(), format);
      // Append at the end of the draft; this emits an update → autosave persists.
      editor.chain().focus("end").insertContent(html).run();
    } catch {
      setImportError("Import failed. Check the file and try again.");
    }
  }

  async function onDuplicate() {
    const copy = await duplicate.mutateAsync(initial.id);
    router.push(`/docs/${copy.id}`);
  }
  async function onDelete() {
    if (!window.confirm(`Delete “${title}”? This cannot be undone.`)) return;
    await remove.mutateAsync(initial.id);
    router.push("/docs");
    router.refresh();
  }
  async function onLeave() {
    if (!window.confirm(`Leave “${title}”? You'll lose access until it's shared again.`)) return;
    await leave.mutateAsync(initial.id);
    router.push("/docs");
    router.refresh();
  }

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
    <main className="mx-auto w-full max-w-[1000px] px-6 py-10 md:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 text-[13px]">
        <div className="flex items-center gap-2">
          <Link
            href="/docs"
            className="font-medium text-ink-violet underline decoration-1 underline-offset-2 hover:text-electric-violet"
          >
            ← All documents
          </Link>
          <span className="mx-1 h-4 w-px bg-carbon/15" />
          <DocAction onClick={onDuplicate} disabled={actionBusy}>Duplicate</DocAction>
          {access === "owner" ? (
            <DocAction onClick={onDelete} disabled={actionBusy} danger>Delete</DocAction>
          ) : (
            <DocAction onClick={onLeave} disabled={actionBusy} danger>Leave</DocAction>
          )}
        </div>
        <div className="flex items-center gap-4">
          {canWrite && (
            <>
              <button
                type="button"
                onClick={() => importInput.current?.click()}
                className="rounded-[8px] border border-carbon/12 px-2.5 py-1 text-[12px] font-medium text-pewter transition-colors hover:bg-newsprint"
              >
                Import into draft
              </button>
              <input
                ref={importInput}
                type="file"
                accept=".txt,.md,.markdown,text/plain,text/markdown"
                onChange={onImportIntoDoc}
                className="hidden"
              />
            </>
          )}
          <ExportButtons editor={editor} title={title} />
          <span className="flex items-center gap-2 text-[13px] text-graphite">
            {access === "owner" && "You own this"}
            {access === "edit" && `Shared by ${doc.owner.name} · can edit`}
            {access === "view" && `Shared by ${doc.owner.name} · read-only`}
            {canWrite && <SaveBadge status={save.status} onRetry={save.retry} />}
          </span>
        </div>
      </div>

      {importError && <p className="mb-3 text-[13px] text-[#b00020]">{importError}</p>}

      {save.status === "conflict" && <ConflictBanner onReload={reloadRemote} />}

      <input
        value={title}
        onChange={(e) => { setTitle(e.target.value); save.saveTitle(e.target.value); }}
        disabled={!canWrite}
        className="font-editorial mb-5 w-full border-none bg-transparent text-[44px] leading-[1.1] text-press-black placeholder:text-ash focus:outline-none disabled:opacity-100"
        placeholder="Untitled"
      />

      {canWrite && editor && <Toolbar editor={editor} disabled={save.status === "conflict"} />}

      <div className="rounded-[16px] border border-carbon/10 bg-paper-white px-8 py-7 shadow-[var(--shadow-subtle)]">
        <EditorContent editor={editor} />
      </div>

      <FilesPanel docId={initial.id} files={doc.files} canWrite={canWrite} />

      {access === "owner" && <SharePanel docId={initial.id} shares={doc.shares} />}
    </main>
  );
}

function DocAction({ onClick, children, danger, disabled }: { onClick: () => void; children: React.ReactNode; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-[8px] px-2 py-1 text-[13px] font-medium transition-colors disabled:opacity-40 ${
        danger ? "text-[#b00020] hover:bg-[#b00020]/8" : "text-ink-violet hover:bg-newsprint"
      }`}
    >
      {children}
    </button>
  );
}

function SaveBadge({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: status === "error" ? "#b00020" : status === "conflict" ? "#1100ff" : status === "saving" ? "#666666" : "#0a0a0a" }} />
      {(status === "clean" || status === "saved") && <span className="text-pewter">Saved</span>}
      {status === "dirty" && <span className="text-graphite">Editing…</span>}
      {status === "saving" && <span className="text-graphite">Saving…</span>}
      {status === "error" && (
        <button onClick={onRetry} className="font-medium text-[#b00020] underline decoration-1 underline-offset-2">Save failed — retry</button>
      )}
      {status === "conflict" && <span className="text-ink-violet">Out of date</span>}
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
    <span className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => download(`${base}.md`, htmlToMarkdown(editor.getHTML()), "text/markdown")}
        className="rounded-[8px] border border-carbon/12 px-2.5 py-1 text-[12px] font-medium text-pewter transition-colors hover:bg-newsprint"
      >
        Export .md
      </button>
      <button
        type="button"
        onClick={() => download(`${base}.txt`, editor.getText(), "text/plain")}
        className="rounded-[8px] border border-carbon/12 px-2.5 py-1 text-[12px] font-medium text-pewter transition-colors hover:bg-newsprint"
      >
        Export .txt
      </button>
    </span>
  );
}

function ConflictBanner({ onReload }: { onReload: () => void }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-4 rounded-[12px] border border-carbon/12 bg-newsprint px-5 py-3.5 text-[14px] text-slate">
      <span className="flex items-center gap-2.5">
        <span className="h-2 w-2 shrink-0 rounded-full bg-electric-violet" />
        This document changed in another session. Editing is paused to avoid overwriting it.
      </span>
      <button
        onClick={onReload}
        className="shrink-0 rounded-[8px] bg-press-black px-3.5 py-1.5 font-semibold text-paper-white transition-colors hover:bg-carbon"
      >
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
      className={`rounded-[8px] px-2.5 py-1 text-[13px] font-medium transition-colors disabled:opacity-40 ${active ? "bg-press-black text-paper-white" : "text-pewter hover:bg-newsprint"}`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor, disabled }: { editor: TiptapEditor; disabled?: boolean }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-1 rounded-[12px] border border-carbon/10 bg-paper-white px-2 py-1.5 shadow-[var(--shadow-subtle)]">
      <Btn title="Bold" disabled={disabled} active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></Btn>
      <Btn title="Italic" disabled={disabled} active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></Btn>
      <Btn title="Underline" disabled={disabled} active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></Btn>
      <Btn title="Strikethrough" disabled={disabled} active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></Btn>
      <span className="mx-1.5 h-5 w-px bg-carbon/10" />
      <Btn title="Heading 1" disabled={disabled} active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</Btn>
      <Btn title="Heading 2" disabled={disabled} active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</Btn>
      <Btn title="Heading 3" disabled={disabled} active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</Btn>
      <span className="mx-1.5 h-5 w-px bg-carbon/10" />
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
    <section className="mt-8">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.11em] text-smoke">Attachments</h2>
      {canWrite && (
        <div className="mb-3">
          <input
            type="file"
            onChange={onUpload}
            disabled={upload.isPending}
            className="block text-[13px] text-graphite file:mr-3 file:rounded-[8px] file:border file:border-ink-violet/40 file:bg-paper-white file:px-3 file:py-1.5 file:text-[13px] file:font-medium file:text-ink-violet hover:file:bg-newsprint"
          />
          <p className="mt-2 text-[12px] text-smoke">
            Supported: PNG, JPG, GIF, WebP, PDF, TXT, Markdown, CSV — max 5 MB.
          </p>
          {upload.isError && <p className="mt-1 text-[13px] text-[#b00020]">{(upload.error as Error).message}</p>}
        </div>
      )}
      {files.length === 0 ? (
        <p className="text-[14px] text-graphite">No attachments.</p>
      ) : (
        <ul className="overflow-hidden rounded-[16px] border border-carbon/10 bg-paper-white">
          {files.map((f, i) => (
            <li key={f.id} className={`flex items-center justify-between px-4 py-2.5 text-[14px] ${i > 0 ? "border-t border-carbon/8" : ""}`}>
              <a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" className="font-medium text-ink-violet underline decoration-1 underline-offset-2 hover:text-electric-violet">
                {f.filename}
              </a>
              <span className="text-[11px] uppercase tracking-[0.11em] text-smoke">{fmtSize(f.size)}</span>
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
    <section className="mt-8 rounded-[16px] border border-carbon/10 bg-paper-white p-6 shadow-[var(--shadow-subtle)]">
      <h2 className="mb-1 font-editorial text-[26px] leading-tight">Share this document</h2>
      <p className="mb-4 text-[13px] text-graphite">Grant another Folio user access by email.</p>
      <form onSubmit={grant} className="flex flex-wrap items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="person@example.com"
          required
          className="flex-1 rounded-[8px] border border-carbon/15 bg-newsprint px-3.5 py-2 text-[14px] text-press-black placeholder:text-smoke focus:bg-paper-white"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as ShareRole)}
          className="rounded-[8px] border border-carbon/15 bg-newsprint px-3 py-2 text-[14px] text-press-black"
        >
          <option value="EDIT">Can edit</option>
          <option value="VIEW">Can view</option>
        </select>
        <button
          disabled={share.isPending}
          className="rounded-[8px] bg-press-black px-4 py-2 text-[14px] font-semibold text-paper-white transition-colors hover:bg-carbon disabled:opacity-50"
        >
          Share
        </button>
      </form>
      {share.isError && <p className="mt-2 text-[13px] text-[#b00020]">{(share.error as Error).message}</p>}
      {shares.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-carbon/8 pt-4">
          {shares.map((s) => (
            <li key={s.user.email} className="flex items-center justify-between gap-3 text-[14px]">
              <span className="min-w-0 truncate text-slate">
                <span className="font-medium">{s.user.name}</span>
                <span className="text-graphite"> · {s.user.email} · {s.role === "EDIT" ? "can edit" : "can view"}</span>
              </span>
              <button
                onClick={() => revoke.mutate(s.user.email)}
                className="shrink-0 text-[13px] font-medium text-ink-violet underline decoration-1 underline-offset-2 hover:text-electric-violet"
              >
                Unshare
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
