import { describe, it, expect } from "vitest";
import { nextStatus, type SaveStatus } from "../save-machine";

describe("nextStatus — save lifecycle", () => {
  it("clean → dirty on edit", () => {
    expect(nextStatus("clean", "edit")).toBe("dirty");
  });

  it("dirty → saving on flush, then saved on saveOk", () => {
    expect(nextStatus("dirty", "flush")).toBe("saving");
    expect(nextStatus("saving", "saveOk")).toBe("saved");
  });

  it("saving → error on saveFail, and error retries via flush", () => {
    expect(nextStatus("saving", "saveFail")).toBe("error");
    expect(nextStatus("error", "flush")).toBe("saving");
  });

  it("saving → conflict on stale (409)", () => {
    expect(nextStatus("saving", "stale")).toBe("conflict");
  });

  it("dirty → conflict on remoteChanged (would clobber)", () => {
    expect(nextStatus("dirty", "remoteChanged")).toBe("conflict");
  });

  it("clean stays clean on remoteChanged (safe silent swap)", () => {
    expect(nextStatus("clean", "remoteChanged")).toBe("clean");
    expect(nextStatus("saved", "remoteChanged")).toBe("clean");
  });

  it("conflict only escapes via reload", () => {
    expect(nextStatus("conflict", "edit")).toBe("conflict");
    expect(nextStatus("conflict", "remoteChanged")).toBe("conflict");
    expect(nextStatus("conflict", "reload")).toBe("clean");
  });

  it("ignores nonsensical transitions", () => {
    const cases: [SaveStatus, SaveStatus][] = [
      [nextStatus("clean", "saveOk"), "clean"],
      [nextStatus("saved", "flush"), "saved"],
    ];
    for (const [got, want] of cases) expect(got).toBe(want);
  });
});
