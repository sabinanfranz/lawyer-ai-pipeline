import { describe, expect, it } from "vitest";
import { DraftNaverLLMResponseSchema } from "./schema";

describe("DraftNaver schema", () => {
  it("requires 3~5 title_candidates", () => {
    expect(() =>
      DraftNaverLLMResponseSchema.parse({ title_candidates: ["a", "b"], body_md_lines: Array(10).fill("x") })
    ).toThrow();

    expect(() =>
      DraftNaverLLMResponseSchema.parse({ title_candidates: ["a", "b", "c"], body_md_lines: Array(10).fill("x") })
    ).not.toThrow();

    expect(() =>
      DraftNaverLLMResponseSchema.parse({
        title_candidates: ["a", "b", "c", "d", "e", "f"],
        body_md_lines: Array(10).fill("x"),
      })
    ).toThrow();
  });
});
