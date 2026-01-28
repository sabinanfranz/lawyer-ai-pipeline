Last updated: 2026-01-27

# 00_INDEX_llm

## 읽기 순서
0) 00_INDEX → 02_ARCHITECTURE → 03_REPO_MAP → 07_API_CONTRACTS → 06_AGENT_RUNTIME_SSOT → 05_RULEBOOK_COMPLIANCE → 04_DATA_MODEL → 08_RUNBOOK_LOCAL_DEV → 09_TESTING_AND_QA → 01_GLOSSARY → 99_OPEN_QUESTIONS

## 불변식 (SSOT)
- LLM 실패/비활성/JSON 깨짐 시에도 fallback으로 **유효한 출력 스키마**를 반환해야 한다.
- Agent cache key = `agent_name + agent_version + variant_key + prompt_version + scope_key + input_hash` (input_hash는 canonicalizeJson→sha256).
- `/api/content/{shareId}/approve`는 **idempotent**; revised/report가 있으면 재생성 금지.
- approve idempotent는 **채널 단위**로 적용: 이미 channel별 revised/report가 있으면 해당 채널은 재생성 금지.
- “전문” 표현은 워크플로 전체에서 금지: ruleScan 탐지 → deterministic rewrite 치환 → LLM 결과에도 enforcement.

## 문서 업데이트 트리거
- 아키텍처/라우트 흐름 변경 → 02/07 갱신
- 파일 경로/레포 구조 변경 → 03 갱신
- Prisma schema/DB 저장 필드 변경 → 04 갱신
- ruleScan/치환/컴플라이언스 규칙 변경 → 05 갱신
- AgentContext/Runtime/캐시 키/LLM 처리 변경 → 06 갱신
- API 응답 shape 변경 → 07 갱신
- 로컬 실행/테스트 절차 변경 → 08/09 갱신
- 용어/옵션 추가 → 01 갱신
