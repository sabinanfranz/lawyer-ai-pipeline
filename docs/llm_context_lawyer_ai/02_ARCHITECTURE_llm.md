Last updated: 2026-01-20

# 02_ARCHITECTURE_llm

```mermaid
graph TD
  A[/new Step1 입력/] -->|POST /api/topic-candidates| B[TopicCandidatesAgent]
  B --> A2[/new Step2 후보 7개 표시]
  A2 -->|선택 후 POST /api/content| C[DraftNaverAgent]
  C --> D[getContentRepo로 저장 + shareId]
  D --> E[/c/{shareId} GET /api/content/{shareId}/]
  E -->|승인 클릭 POST /api/content/{shareId}/approve| F[ComplianceRewriteAgent]
  F --> D
```

- Repo switch: `getContentRepo()`는 `DATABASE_URL`이 있으면 PrismaContentRepo, 없으면 InMemoryContentRepo.
- prompts 경로: `prompts/<agent>/<variant>/<version>/{system,user,repair}.txt`
- Agent 실행: runAgent가 runtime(캐시/프롬프트/LLM) 생성 후 agent.run 호출.
