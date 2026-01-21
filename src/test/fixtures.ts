import { IntakeSchema } from "@/lib/schemas/intake";

export function sampleIntake() {
  const obj = {
    industry: "IT/SaaS",
    target_role: "CEO/대표",
    issue_stage: "예방",
    pain_picker: ["contract_outsourcing_breakdown"],
    content_goal: "신뢰 쌓기(초기 리드)",
    offer_material: "체크리스트",
    pain_sentence: "외주 검수 기준 때문에 분쟁이 반복돼요.",
    experience_seed: "계약서 없이 메일로만 진행하다가 정산에서 싸웁니다.",
    must_avoid: "무료, 1위, 전문, 승소",
  };

  return IntakeSchema.parse(obj);
}
