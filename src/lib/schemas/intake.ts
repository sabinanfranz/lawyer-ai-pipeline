import { z } from "zod";
import {
  INDUSTRY_OPTIONS,
  TARGET_ROLE_OPTIONS,
  ISSUE_STAGE_OPTIONS,
  CONTENT_GOAL_OPTIONS,
  OFFER_MATERIAL_OPTIONS,
} from "@/lib/constants/options";
import { PAIN_PICKER_ENUM } from "@/lib/constants/painPicker";

const Trimmed = z.string().trim();

export const IntakeSchema = z.object({
  industry: z.enum(INDUSTRY_OPTIONS),
  target_role: z.enum(TARGET_ROLE_OPTIONS),
  issue_stage: z.enum(ISSUE_STAGE_OPTIONS),

  pain_picker: z
    .array(z.enum(PAIN_PICKER_ENUM))
    .min(1, "pain_picker는 최소 1개 선택해야 합니다.")
    .max(2, "pain_picker는 최대 2개까지 선택할 수 있습니다."),

  content_goal: z.enum(CONTENT_GOAL_OPTIONS),
  offer_material: z.enum(OFFER_MATERIAL_OPTIONS),

  pain_sentence: Trimmed.max(200, "pain_sentence는 200자 이내로 입력해주세요.").optional().or(z.literal("")),
  experience_seed: Trimmed.max(200, "experience_seed는 200자 이내로 입력해주세요.").optional().or(z.literal("")),
  must_avoid: Trimmed.max(160, "must_avoid는 160자 이내로 입력해주세요.").optional().or(z.literal("")),
});

export type IntakeInput = z.infer<typeof IntakeSchema>;
