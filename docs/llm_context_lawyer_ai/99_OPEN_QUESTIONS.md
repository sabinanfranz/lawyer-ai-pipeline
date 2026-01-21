Last updated: 2026-01-20

# 99_OPEN_QUESTIONS

- LinkedIn/Threads 등 추가 채널 어댑터를 언제/어떻게 붙일지 (프롬프트/스키마 분리 계획 필요)
- 캐시 영속화 필요 여부(InMemory → Redis 등)와 캐시 만료 정책
- telemetry/비용/로그 정책: DEBUG_AGENT 외에 prod 로깅/집계 계획
- 프롬프트 버전 관리 정책: v2로 올리는 기준, 구버전 호환성 유지 여부
- HTML sanitization/정적 검열 적용 여부(현재는 복사 목적, 추가 보안 필요성 검토)
