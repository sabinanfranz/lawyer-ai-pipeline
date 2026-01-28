import { describe, it, expect } from "vitest";
import { DraftThreadsLLMResponseSchema } from "./schema";

describe("DraftThreads schema", () => {
  it("passes with 3 lines (new 3-step thread)", () => {
    const threeLines = { title_candidates: ["a", "b", "c"], body_md_lines: ["[1/3] a", "[2/3] b", "[3/3] c"] };
    expect(() => DraftThreadsLLMResponseSchema.parse(threeLines)).not.toThrow();
  });

  it("passes with 5 lines (backward compatibility)", () => {
    const fiveLines = {
      title_candidates: ["a", "b", "c"],
      body_md_lines: ["[1/5] a", "[2/5] b", "[3/5] c", "[4/5] d", "[5/5] e"],
    };
    expect(() => DraftThreadsLLMResponseSchema.parse(fiveLines)).not.toThrow();
  });
});
