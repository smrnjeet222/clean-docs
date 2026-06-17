"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { createSaveStore, type SaveStatus } from "@/lib/save-machine";
import { ApiError } from "./api";
import { useSaveDocument } from "./documents";

const DEBOUNCE_MS = 800;

/**
 * Orchestrates the save finite state machine (src/lib/save-machine.ts) with the
 * TanStack save mutation and a debounce. The machine is the source of truth for
 * `status`; this hook owns the side effects (timers, network) the machine must
 * not. Returns the controls the editor needs, including `send`/`setVersion` so
 * the editor's polling layer can drive conflict transitions.
 */
export function useDocumentSave(docId: string, initialVersion: number) {
  // Store is created once; reading it via useState (not useRef) keeps it out of
  // render-time ref access. send/setVersion are stable zustand setters.
  const [store] = useState(() => createSaveStore(initialVersion));
  const status = useStore(store, (s) => s.status);
  const version = useStore(store, (s) => s.version);
  const send = useStore(store, (s) => s.send);
  const setVersion = useStore(store, (s) => s.setVersion);

  const save = useSaveDocument(docId);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestHtml = useRef<string | null>(null);
  const sentHtml = useRef<string | null>(null);
  const flushRef = useRef<() => void>(() => {});

  const arm = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => flushRef.current(), DEBOUNCE_MS);
  }, []);

  const flush = useCallback(async () => {
    const html = latestHtml.current;
    if (html === null) return;
    const st = store.getState();
    if (st.status !== "dirty" && st.status !== "error") return;
    st.send("flush");
    sentHtml.current = html;
    try {
      const res = await save.mutateAsync({ contentHtml: html, lastSeenVersion: st.version });
      store.getState().setVersion(res.version);
      store.getState().send("saveOk");
      // Edited again while the save was in flight? Re-run.
      if (latestHtml.current !== sentHtml.current) {
        store.getState().send("edit");
        arm();
      }
    } catch (err) {
      store.getState().send(err instanceof ApiError && err.status === 409 ? "stale" : "saveFail");
    }
  }, [store, save, arm]);

  // Keep the armed timer pointing at the latest flush without a declaration cycle.
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const onEdit = useCallback(
    (html: string) => {
      latestHtml.current = html;
      if (store.getState().status === "conflict") return; // editing blocked until reload
      store.getState().send("edit");
      arm();
    },
    [store, arm],
  );

  const retry = useCallback(() => {
    if (store.getState().status === "error") arm();
  }, [store, arm]);

  // Title is not under optimistic-concurrency control (no version bump), so it
  // saves on its own debounce, independent of the content machine.
  const saveTitle = useCallback(
    (title: string) => {
      if (titleTimer.current) clearTimeout(titleTimer.current);
      titleTimer.current = setTimeout(() => save.mutate({ title }), DEBOUNCE_MS);
    },
    [save],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (titleTimer.current) clearTimeout(titleTimer.current);
    },
    [],
  );

  return {
    status: status as SaveStatus,
    version,
    onEdit,
    saveTitle,
    retry,
    send,
    setVersion,
  };
}
