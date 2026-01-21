# Lawyer AI Pipeline (Local MVP)

## 1) Requirements
- Node.js (LTS)
- Docker (for Postgres, optional)

## 2) Local Run (LLM mock)
```bash
npm install
cp .env.example .env
# LLM_MODE=mock
npm run dev
```

## 3) OpenAI Mode (optional)
* `.env`에서 `LLM_MODE=openai`, `OPENAI_API_KEY=...`
```bash
npm run dev
```

## 4) Database (optional but recommended)
```bash
docker compose up -d
npx prisma migrate dev
npm run dev
```

## 5) Tests
```bash
npm test
```

## 6) Flow
1. /new 입력 → 주제 후보 생성 → 1개 선택 → draft 생성
2. /c/{shareId}에서 draft 복사
3. 승인 클릭 → compliance report + revised 생성/복사

## Notes
- 본 도구는 일반 정보 제공 목적이며, 발행 전 변호사 검수가 필요합니다.
- 사건/의뢰인 식별 정보(회사명/실명/날짜/금액/지역 조합)를 입력하지 마세요.
