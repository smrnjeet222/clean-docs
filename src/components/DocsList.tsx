"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCreateDocument, useImportDocument } from "@/hooks/documents";
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

export default function DocsList({ owned, shared }: { owned: OwnedDoc[]; shared: SharedDoc[] }) {
  const router = useRouter();
  const create = useCreateDocument();
  const importDoc = useImportDocument();
  const fileInput = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

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

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={createDoc}
          disabled={create.isPending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {create.isPending ? "Creating…" : "+ New document"}
        </button>
        <button
          onClick={() => fileInput.current?.click()}
          disabled={importDoc.isPending}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
        >
          {importDoc.isPending ? "Importing…" : "↑ Import .txt / .md"}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".txt,.md,.markdown,text/plain,text/markdown"
          onChange={onImport}
          className="hidden"
        />
        {importError && <span className="text-sm text-red-600">{importError}</span>}
      </div>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Owned by you
        </h2>
        {owned.length === 0 ? (
          <p className="text-sm text-neutral-400">No documents yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
            {owned.map((d) => (
              <li key={d.id}>
                <Link href={`/docs/${d.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50">
                  <span className="font-medium text-neutral-900">{d.title}</span>
                  <span className="text-xs text-neutral-400">{fmt(d.updatedAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Shared with you
        </h2>
        {shared.length === 0 ? (
          <p className="text-sm text-neutral-400">Nothing shared with you yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
            {shared.map((d) => (
              <li key={d.id}>
                <Link href={`/docs/${d.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50">
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-neutral-900">{d.title}</span>
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-700">
                      Shared · {d.role}
                    </span>
                    <span className="text-xs text-neutral-400">by {d.ownerName}</span>
                  </span>
                  <span className="text-xs text-neutral-400">{fmt(d.updatedAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
