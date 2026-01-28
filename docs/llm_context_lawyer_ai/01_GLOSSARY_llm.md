Last updated: 2026-01-28

# 01_GLOSSARY_llm

- **Channel**: 멀티채널 출력 축을 구분하는 1급 키. 허용 값은 `naver | linkedin | threads`, 표시 순서는 `CHANNEL_ORDER`(네이버→LinkedIn→Threads)로 고정. Prisma enum `Channel`과 TS SSOT(`src/shared/channel.ts`)가 동일 값을 공유한다.
- **shareId**: 공유 링크 키. content 레코드의 외부 식별자.
- **scope_key**: agent 실행 범위 키(주로 shareId 또는 "single"). 캐시 키와 컨텍스트에 포함.
- **variant_key**: 프롬프트/agent 변형 식별자(기본: "default").
- **prompt_version**: 프롬프트 버전 디렉터리(v1 등). 바뀌면 캐시 미스 유도.
- **canonicalizeJson**: 입력을 키 정렬 후 JSON 문자열화하는 함수. input_hash 계산 입력.
- **input_hash (sha256)**: canonicalizeJson 결과에 대한 sha256. 캐시 키 구성요소.
- **cache_key**: `agent:version:variant:prompt_version:scope:input_hash`.
- **ruleScan**: 규칙 기반 탐지기. 금지/주의 표현을 스캔하고 risk_score/ issues/mustAvoidTokens 생성.
- **deterministic enforcement**: ruleScan 결과 기반으로 금지 표현을 치환/삭제하고 디스클레이머를 강제하는 단계.
- **jsonGuard**: LLM 원본 → loose parse → zod validate → repair(≤2) → fallback 체인.
- **ContentRecord**: API/Repo에서 사용하는 공용 구조. 멀티채널 기준으로 `drafts{naver,linkedin,threads}`를 항상 포함하고, `revised?`와 `compliance_reports?`는 채널별 partial map으로 제공된다(레거시 단일 draft/revised/report는 서버에서 naver 채널로 승격/보정).
- **Content/ContentVersion/ComplianceReport**: Prisma 테이블. Content는 shareId/상태, ContentVersion은 draft/revised 버전 저장, ComplianceReport는 risk_score/issues/summary 저장.
