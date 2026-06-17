"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useCreateDocument,
  useImportDocument,
  useDeleteDocument,
  useDuplicateDocument,
  useLeaveDocument,
} from "@/hooks/documents";
import { fileTextToHtml, formatForFilename, titleFromFilename } from "@/lib/document-format";

type OwnedDoc = { id: string; title: string; updatedAt: string };
type SharedDoc = OwnedDoc & { ownerName: string; role: "VIEW" | "EDIT" };

// Deterministic across server/client: fixed locale + UTC so SSR and hydration
// produce the same string (avoids React hydration mismatch).
const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

function fmt(iso: string) {
  return `${dateFmt.format(new Date(iso))} UTC`;
}

function GhostBtn({
  onClick,
  children,
  danger,
  disabled,
}: {
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-[8px] px-2.5 py-1 text-[12px] font-medium transition-colors disabled:opacity-40 ${
        danger ? "text-[#b00020] hover:bg-[#b00020]/8" : "text-ink-violet hover:bg-newsprint"
      }`}
    >
      {children}
    </button>
  );
}

export default function DocsList({ owned, shared }: { owned: OwnedDoc[]; shared: SharedDoc[] }) {
  const router = useRouter();
  const create = useCreateDocument();
  const importDoc = useImportDocument();
  const duplicate = useDuplicateDocument();
  const remove = useDeleteDocument();
  const leave = useLeaveDocument();
  const fileInput = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const busy = duplicate.isPending || remove.isPending || leave.isPending;

  async function createDoc() {
    const doc = await create.mutateAsync();
    router.push(`/docs/${doc.id}`);
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportError(null);
    const format = formatForFilename(file.name);
    if (!format) { setImportError("Only .txt and .md files can be imported."); return; }
    try {
      const html = fileTextToHtml(await file.text(), format);
      const doc = await importDoc.mutateAsync({ title: titleFromFilename(file.name), contentHtml: html });
      router.push(`/docs/${doc.id}`);
    } catch {
      setImportError("Import failed. Check the file and try again.");
    }
  }

  async function copyDoc(id: string) {
    const copy = await duplicate.mutateAsync(id);
    router.push(`/docs/${copy.id}`);
  }

  async function deleteDoc(id: string, title: string) {
    if (!window.confirm(`Delete “${title}”? This cannot be undone.`)) return;
    await remove.mutateAsync(id);
    router.refresh();
  }

  async function leaveDoc(id: string, title: string) {
    if (!window.confirm(`Leave “${title}”? You'll lose access until it's shared again.`)) return;
    await leave.mutateAsync(id);
    router.refresh();
  }

  const rowBase = "flex items-center gap-4 px-5 py-4 transition-colors hover:bg-newsprint";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={createDoc}
          disabled={create.isPending}
          className="rounded-[8px] bg-press-black px-4 py-2.5 text-[15px] font-semibold text-paper-white shadow-[var(--shadow-subtle)] transition-colors hover:bg-carbon disabled:opacity-50"
        >
          {create.isPending ? "Creating…" : "New document"}
        </button>
        <button
          onClick={() => fileInput.current?.click()}
          disabled={importDoc.isPending}
          className="rounded-[8px] border border-ink-violet/40 px-4 py-2.5 text-[15px] font-medium text-ink-violet transition-colors hover:bg-newsprint disabled:opacity-50"
        >
          {importDoc.isPending ? "Importing…" : "Import .txt / .md"}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".txt,.md,.markdown,text/plain,text/markdown"
          onChange={onImport}
          className="hidden"
        />
        {importError && <span className="text-[13px] text-[#b00020]">{importError}</span>}
      </div>

      <section>
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.11em] text-smoke">
          Owned by you
        </h2>
        {owned.length === 0 ? (
          <p className="text-[15px] text-graphite">No documents yet. Start one above.</p>
        ) : (
          <ul className="overflow-hidden rounded-[16px] border border-carbon/10 bg-paper-white shadow-[var(--shadow-subtle)]">
            {owned.map((d, i) => (
              <li key={d.id} className={`${rowBase} ${i > 0 ? "border-t border-carbon/8" : ""}`}>
                <Link href={`/docs/${d.id}`} className="min-w-0 flex-1 truncate text-[16px] font-medium text-slate">
                  {d.title}
                </Link>
                <span className="hidden shrink-0 text-[11px] uppercase tracking-[0.11em] text-smoke sm:inline">{fmt(d.updatedAt)}</span>
                <span className="flex shrink-0 items-center gap-0.5">
                  <GhostBtn onClick={() => copyDoc(d.id)} disabled={busy}>Copy</GhostBtn>
                  <GhostBtn onClick={() => deleteDoc(d.id, d.title)} disabled={busy} danger>Delete</GhostBtn>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.11em] text-smoke">
          Shared with you
        </h2>
        {shared.length === 0 ? (
          <p className="text-[15px] text-graphite">Nothing shared with you yet.</p>
        ) : (
          <ul className="overflow-hidden rounded-[16px] border border-carbon/10 bg-paper-white shadow-[var(--shadow-subtle)]">
            {shared.map((d, i) => (
              <li key={d.id} className={`${rowBase} ${i > 0 ? "border-t border-carbon/8" : ""}`}>
                <Link href={`/docs/${d.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="truncate text-[16px] font-medium text-slate">{d.title}</span>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-[40px] border border-carbon/10 bg-newsprint px-2.5 py-0.5 text-[11px] font-medium text-pewter">
                    <span className="h-1.5 w-1.5 rounded-full bg-electric-violet" />
                    {d.role === "EDIT" ? "Can edit" : "View"}
                  </span>
                  <span className="hidden shrink-0 text-[13px] text-graphite md:inline">by {d.ownerName}</span>
                </Link>
                <span className="hidden shrink-0 text-[11px] uppercase tracking-[0.11em] text-smoke sm:inline">{fmt(d.updatedAt)}</span>
                <span className="flex shrink-0 items-center gap-0.5">
                  <GhostBtn onClick={() => copyDoc(d.id)} disabled={busy}>Copy</GhostBtn>
                  <GhostBtn onClick={() => leaveDoc(d.id, d.title)} disabled={busy} danger>Leave</GhostBtn>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
