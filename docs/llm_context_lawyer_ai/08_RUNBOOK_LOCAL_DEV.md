Last updated: 2026-01-21

# 08_RUNBOOK_LOCAL_DEV

## 로컬 실행 (LLM mock)
```bash
npm install
cp .env.example .env
# LLM_MODE=mock
npm run dev
```
- `/new` → 후보 생성 → draft 생성 → `/c/{shareId}` → 승인

## OpenAI 모드 (선택)
- `.env`: `LLM_MODE=openai`, `OPENAI_API_KEY` 설정
- gpt-5 계열 권장 값: `OPENAI_API_STYLE=auto`, `OPENAI_MAX_COMPLETION_TOKENS=8000`, `OPENAI_MAX_OUTPUT_TOKENS=8000`
- `npm run dev`

## Database (선택, 권장)
```bash
docker compose up -d
npx prisma migrate dev
npm run dev
```
- DATABASE_URL 설정 시 PrismaContentRepo 사용, 없으면 InMemoryContentRepo 사용

## 재현 체크리스트
- 같은 입력으로 /api/topic-candidates 두 번 호출 → openai 정상 응답이면 두 번째 cache_hit=true (openai 모드에서 fallback이면 캐시 안 됨)
- approve 두 번 눌러도 결과 재생성 안 됨(idempotent)
- 금지어가 draft에 포함돼도 revised에서 제거/완곡화

## 트러블슈팅
- `DEBUG_AGENT=1`로 실행하면 env 판단, LLM 요청/에러, jsonGuard repair, cache hit/miss, fallback 이유(LLM_ERROR/JSON_GUARD_FALLBACK) 로그 확인 가능. gpt-5는 responses API로 자동 라우팅되며 빈 출력이 오면 토큰을 상향해 1회 재시도함.
- 포트 충돌: `npm run dev -- --port 3001`
- Prisma migrate 실패: DB 실행 확인(docker compose), DATABASE_URL 점검
- Docker 미사용 시: DATABASE_URL 비우고 InMemory 모드로 개발
