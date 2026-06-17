import { createStore } from "zustand/vanilla";

/**
 * The save lifecycle as an explicit finite state machine.
 *
 * `nextStatus` is the pure core — the test surface. The zustand store wraps it
 * with the small amount of data the orchestrator needs (the document version for
 * optimistic concurrency). Side effects (debounce, network) live in the
 * orchestrating hook, never here.
 */
export type SaveStatus = "clean" | "dirty" | "saving" | "saved" | "error" | "conflict";

export type SaveEvent =
  | "edit"          // user changed the document
  | "flush"         // debounce elapsed; attempt a save
  | "saveOk"        // PUT succeeded
  | "saveFail"      // PUT failed (network / 5xx)
  | "stale"         // PUT rejected with 409 — someone else wrote first
  | "remoteChanged" // a poll observed a newer version on the server
  | "reload";       // user accepted the remote version

/** Pure transition. Unknown (state, event) pairs leave the state unchanged. */
export function nextStatus(status: SaveStatus, event: SaveEvent): SaveStatus {
  switch (status) {
    case "clean":
      if (event === "edit") return "dirty";
      return status; // remoteChanged while clean: content swaps silently, stays clean
    case "saved":
      if (event === "edit") return "dirty";
      if (event === "remoteChanged") return "clean";
      return status;
    case "dirty":
      if (event === "flush") return "saving";
      if (event === "remoteChanged") return "conflict";
      return status;
    case "saving":
      if (event === "saveOk") return "saved";
      if (event === "saveFail") return "error";
      if (event === "stale") return "conflict";
      return status; // edit during save: handled by orchestrator re-flush
    case "error":
      if (event === "edit") return "dirty";
      if (event === "flush") return "saving"; // retry
      return status;
    case "conflict":
      if (event === "reload") return "clean";
      return status; // editing is blocked in conflict until reload
    default:
      return status;
  }
}

export type SaveState = {
  status: SaveStatus;
  version: number;
  send: (event: SaveEvent) => void;
  setVersion: (version: number) => void;
};

/** One store instance per open Document. */
export function createSaveStore(initialVersion: number) {
  return createStore<SaveState>((set) => ({
    status: "clean",
    version: initialVersion,
    send: (event) => set((s) => ({ status: nextStatus(s.status, event) })),
    setVersion: (version) => set({ version }),
  }));
}

export type SaveStore = ReturnType<typeof createSaveStore>;
