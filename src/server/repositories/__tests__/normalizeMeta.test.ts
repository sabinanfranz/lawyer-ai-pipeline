import { describe, it, expect } from "vitest";
import { normalizeMeta } from "../prismaContentRepo";
import { INDUSTRY_OPTIONS, TARGET_ROLE_OPTIONS, ISSUE_STAGE_OPTIONS, CONTENT_GOAL_OPTIONS, OFFER_MATERIAL_OPTIONS } from "@/lib/constants/options";
import { PAIN_PICKER_ENUM } from "@/lib/constants/painPicker";

const validIntake = {
  industry: INDUSTRY_OPTIONS[0],
  target_role: TARGET_ROLE_OPTIONS[0],
  issue_stage: ISSUE_STAGE_OPTIONS[0],
  pain_picker: [PAIN_PICKER_ENUM[0]],
  content_goal: CONTENT_GOAL_OPTIONS[0],
  offer_material: OFFER_MATERIAL_OPTIONS[0],
  pain_sentence: "",
  experience_seed: "",
  must_avoid: "",
};

const validTopicCandidates = {
  normalized_brief: {
    persona_summary: "p",
    pain_summary: "pain",
    assumptions: ["a", "b"],
  },
  candidates: Array.from({ length: 7 }).map((_, i) => ({
    id: i + 1,
    title_search: `t${i}`,
    title_share: `s${i}`,
    smartblock_intent: "reaction_response",
    content_role: "cluster",
    hook: "h",
    risk_solved: "r",
    format: "checklist",
    primary_keyword: "kw",
    longtail_keywords: ["k1", "k2", "k3"],
    deliverable: "d",
    cta_one: "c",
    difficulty: "하",
    risk_level: "하",
    hitl_points: ["x", "y"],
  })),
  top3_recommendations: [
    { id: 1, why: "w1" },
    { id: 2, why: "w2" },
    { id: 3, why: "w3" },
  ],
};

const validSelected = validTopicCandidates.candidates[0];

describe("normalizeMeta", () => {
  it("returns parsed meta for valid shapes", () => {
    const out = normalizeMeta({
      intake: validIntake,
      topic_candidates: validTopicCandidates,
      selected_candidate: validSelected,
      agent_debug: { any: true },
    });
    expect(out.intake).toEqual(validIntake);
    expect(out.topic_candidates).toEqual(validTopicCandidates);
    expect(out.selected_candidate).toEqual(validSelected);
    expect(out.agent_debug).toEqual({ any: true });
  });

  it("never throws and returns null fields for invalid raw", () => {
    const out = normalizeMeta(null);
    expect(out.intake).toBeNull();
    expect(out.topic_candidates).toBeNull();
    expect(out.selected_candidate).toBeNull();
  });

  it("supports partial meta", () => {
    const out = normalizeMeta({ intake: validIntake, topic_candidates: "bad", selected_candidate: 123 });
    expect(out.intake).toEqual(validIntake);
    expect(out.topic_candidates).toBeNull();
    expect(out.selected_candidate).toBeNull();
  });
});
