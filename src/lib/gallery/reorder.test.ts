import { describe, expect, it } from "vitest";
import { reorderIds } from "./reorder";

describe("reorderIds", () => {
  it("moves an id from one index to another", () => {
    expect(reorderIds(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(reorderIds(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"]);
  });

  it("is a no-op for equal indexes", () => {
    expect(reorderIds(["a", "b"], 1, 1)).toEqual(["a", "b"]);
  });

  it("returns a copy unchanged for out-of-range indexes", () => {
    expect(reorderIds(["a", "b"], -1, 1)).toEqual(["a", "b"]);
    expect(reorderIds(["a", "b"], 0, 5)).toEqual(["a", "b"]);
  });
});
