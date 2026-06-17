"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./api";

export type AccessLevel = "owner" | "edit" | "view";
export type ShareRole = "VIEW" | "EDIT";

export type DocumentDetail = {
  id: string;
  title: string;
  contentHtml: string;
  version: number;
  updatedAt: string;
  ownerId: string;
  owner: { name: string; email: string };
  shares: { role: ShareRole; user: { id: string; name: string; email: string } }[];
  files: { id: string; filename: string; mimeType: string; size: number }[];
  access: AccessLevel;
};

export type FileItem = DocumentDetail["files"][number];

export const documentKeys = {
  all: ["documents"] as const,
  detail: (id: string) => ["documents", id] as const,
};

/**
 * GET a document. Hydrated from server-rendered props; polled by the editor.
 * When `collaborative`, also refetch on tab focus and network reconnect (with
 * staleTime 0 so a focus always pulls the latest) — catches a co-editor's change
 * the instant you return to the tab, not just on the next poll tick.
 */
export function useDocumentQuery(
  id: string,
  opts: { initialData?: DocumentDetail; refetchInterval?: number | false; collaborative?: boolean } = {},
) {
  const collaborative = opts.collaborative ?? false;
  return useQuery({
    queryKey: documentKeys.detail(id),
    queryFn: () => apiFetch<DocumentDetail>(`/api/documents/${id}`),
    initialData: opts.initialData,
    refetchInterval: opts.refetchInterval ?? false,
    refetchOnWindowFocus: collaborative,
    refetchOnReconnect: collaborative,
    staleTime: collaborative ? 0 : 10_000,
  });
}

export type SaveResult = { id: string; title: string; version: number; updatedAt: string };

/** PUT title/content. Passes lastSeenVersion so the server can reject stale writes (409). */
export function useSaveDocument(id: string) {
  return useMutation({
    mutationFn: (vars: { title?: string; contentHtml?: string; lastSeenVersion?: number }) =>
      apiFetch<SaveResult>(`/api/documents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars),
      }),
  });
}

export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ id: string }>("/api/documents", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: documentKeys.all }),
  });
}

/** Create a new document seeded from imported file content (title + HTML). */
export function useImportDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { title: string; contentHtml: string }) => {
      const doc = await apiFetch<{ id: string }>("/api/documents", { method: "POST" });
      await apiFetch(`/api/documents/${doc.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: vars.title, contentHtml: vars.contentHtml }),
      });
      return doc;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: documentKeys.all }),
  });
}

export function useUploadFile(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return apiFetch<FileItem>(`/api/documents/${id}/files`, { method: "POST", body: fd });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: documentKeys.detail(id) }),
  });
}

export type ShareEntry = { role: ShareRole; user: { id: string; name: string; email: string } };

export function useShareDocument(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { email: string; role: ShareRole }) =>
      apiFetch<ShareEntry>(`/api/documents/${id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vars),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: documentKeys.detail(id) }),
  });
}

export function useRevokeShare(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (email: string) =>
      apiFetch<{ ok: true }>(`/api/documents/${id}/share?email=${encodeURIComponent(email)}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: documentKeys.detail(id) }),
  });
}
