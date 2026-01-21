export const PAIN_PICKER_IDS = [
  "contract_outsourcing_breakdown",
  "contract_acceptance_delay_sla",
  "contract_termination_renewal_notice",

  "hr_probation_lowperformer_process",
  "hr_offboarding_data_account_recovery",
  "hr_noncompete_scope_ambiguity",

  "privacy_processor_vs_thirdparty_confusing",
  "privacy_dpa_clause_worry",
  "privacy_breach_initial_response",

  "ip_outsource_ip_ownership_unclear",
  "ip_opensource_license_risk",
  "ip_trademark_naming_check",

  "ar_payment_delay",
  "ar_settlement_deduction_dispute",

  "compliance_no_internal_approval_policy",
  "compliance_vendor_risk_checklist_needed",
] as const;

export type PainPickerId = (typeof PAIN_PICKER_IDS)[number];

export const PAIN_PICKER_OPTIONS: Array<{ id: PainPickerId; group: string; label: string }> = [
  { id: "contract_outsourcing_breakdown", group: "계약/거래", label: "외주·위수탁 계약이 자주 틀어진다" },
  { id: "contract_acceptance_delay_sla", group: "계약/거래", label: "검수·지연·SLA 때문에 분쟁이 난다" },
  { id: "contract_termination_renewal_notice", group: "계약/거래", label: "해지/갱신 통지가 늘 문제다" },

  { id: "hr_probation_lowperformer_process", group: "인사/노무", label: "수습/평가/저성과자 프로세스가 불안하다" },
  { id: "hr_offboarding_data_account_recovery", group: "인사/노무", label: "퇴사자 자료 반출/계정 회수가 걱정된다" },
  { id: "hr_noncompete_scope_ambiguity", group: "인사/노무", label: "경업금지·전직금지 범위가 애매하다" },

  { id: "privacy_processor_vs_thirdparty_confusing", group: "개인정보/보안", label: "위탁 vs 제3자 제공 구분이 헷갈린다" },
  { id: "privacy_dpa_clause_worry", group: "개인정보/보안", label: "처리위탁 계약 조항이 걱정된다" },
  { id: "privacy_breach_initial_response", group: "개인정보/보안", label: "사고(유출) 초기 대응을 정리해두고 싶다" },

  { id: "ip_outsource_ip_ownership_unclear", group: "IP/기술", label: "개발외주 산출물 저작권 귀속이 불명확하다" },
  { id: "ip_opensource_license_risk", group: "IP/기술", label: "오픈소스 라이선스 리스크가 걱정된다" },
  { id: "ip_trademark_naming_check", group: "IP/기술", label: "상표/브랜드 네이밍을 미리 점검하고 싶다" },

  { id: "ar_payment_delay", group: "채권/정산", label: "대금 미지급·정산 지연 대응이 필요하다" },
  { id: "ar_settlement_deduction_dispute", group: "채권/정산", label: "정산 구조/공제 조항이 늘 분쟁이다" },

  { id: "compliance_no_internal_approval_policy", group: "내부통제/컴플라이언스", label: "내부 승인 체계/규정이 없다" },
  { id: "compliance_vendor_risk_checklist_needed", group: "내부통제/컴플라이언스", label: "거래처 리스크 체크리스트가 필요하다" },
];

// enum-friendly alias
export const PAIN_PICKER_ENUM = PAIN_PICKER_IDS;
