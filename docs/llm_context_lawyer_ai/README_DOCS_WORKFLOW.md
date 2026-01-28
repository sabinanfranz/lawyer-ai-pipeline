Last updated: 2026-01-27

# README_DOCS_WORKFLOW

코드 변경 시 아래 체크리스트에 따라 관련 문서를 업데이트한다.

## 변경 유형별 체크리스트
- [ ] API 응답/요청/에러 코드 변경 → `07_API_CONTRACTS.md`
- [ ] AgentContext/캐시 키/Runtime/LLM 처리 변경 → `06_AGENT_RUNTIME_SSOT.md`
- [ ] Prisma schema나 DB 저장 필드(meta 포함) 변경 → `04_DATA_MODEL.md`
- [ ] ruleScan/치환/컴플라이언스 규칙/디스클레이머 로직 변경 → `05_RULEBOOK_COMPLIANCE.md`
- [ ] 라우트/아키텍처 흐름/Repo 스위치 변경 → `02_ARCHITECTURE_llm.md`, `03_REPO_MAP_llm.md`
- [ ] 파일 경로/구조 이동 → `03_REPO_MAP_llm.md`
- [ ] 테스트 추가/삭제/의미 변경 → `09_TESTING_AND_QA.md`
- [ ] 용어/옵션(enum) 추가/변경 → `01_GLOSSARY_llm.md`
- [ ] 실행/배포/테스트 절차 변경 → `08_RUNBOOK_LOCAL_DEV.md`, `README.md`
- [ ] 금지 표현/“전문” 처리 정책 변화 → `00_INDEX_llm.md`, `05_RULEBOOK_COMPLIANCE.md`

## PR/커밋 전 확인
- [ ] 관련 문서를 위 체크리스트에 따라 업데이트했는가?
- [ ] 문서 상단 `Last updated` 날짜를 갱신했는가?
- [ ] 채널 문자열을 새로 하드코딩하지 않고 `src/shared/channel.ts` SSOT를 사용했는가?
- [ ] `npm test` 통과 여부 확인했는가?
