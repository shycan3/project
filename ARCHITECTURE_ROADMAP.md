# 오퍼가디언 아키텍처 로드맵

작성일: 2026-05-09

이 문서는 현재 실행형 MVP를 실서비스 수준으로 확장하기 위한 우선순위 로드맵이다. 핵심 판단은 다음과 같다.

> 기능을 더 붙이기 전에, 먼저 "왜 이 추천이 나왔고, 왜 바뀌었고, 사용자가 지금 무엇을 해야 하는지"를 시스템이 설명할 수 있게 만든다.

## 1. 채택한 개선 방향

ChatGPT/Gemini 토론 제안 중 다음 방향은 합리적이므로 공식 로드맵에 반영한다.

- 공고 원문 출처와 검수 상태를 추천 결과의 1급 데이터로 승격
- 추천 로직을 `Hard Rule`과 `Soft Score`로 분리
- 매칭 점수와 판정 신뢰도를 분리
- 신뢰도를 사용자 정보, 출처 정보, 규칙 해석 신뢰도로 세분화
- 공통 서류 보관함을 단순 체크박스에서 버전 관리 구조로 확장
- 공고 자격 규칙과 추천 결과를 버전/스냅샷으로 저장
- 프로필/공고/규칙 변경 시 기존 추천을 삭제하지 않고 `stale` 상태로 전환
- 재계산은 이벤트 기반 우선순위 큐로 처리
- 알림은 즉시 발송하지 않고 후보 생성, 중복 제거, 피로도 정책을 통과시킨 뒤 전달
- AI 작성 도우미는 대필자가 아니라 근거 기반 작성 보조자로 제한

## 2. 현재 MVP의 한계

현재 MVP는 로컬 파일 DB와 단순 서버 계산으로 실행 흐름을 검증하는 단계다. 따라서 다음 한계가 있다.

- 공고 출처 정보가 `sourceType`, `source` 중심으로 단순화되어 있다.
- 추천 결과가 런타임에 재계산되며 스냅샷으로 저장되지 않는다.
- `matchScore`와 `confidence`가 있지만, 신뢰도 원천이 분리되어 있지 않다.
- 공통 서류 보관함은 편의 기능이며, 서류 발급일/만료일/파일 버전/공고별 유효성 조건을 아직 검증하지 않는다.
- 알림센터는 앱 내부 알림이며, 피로도 정책과 발송 채널 정책은 아직 없다.
- 운영자 검수는 승인/반려 중심이며, 규칙 변경 이력/영향도 분석/job 상태는 아직 없다.

이 한계는 MVP 실패 요인이 아니라 다음 개발 단계의 명확한 작업 목록이다.

## 3. 우선순위 로드맵

### P0. 출처 신뢰도와 원문 확인

가장 먼저 공고 데이터의 신뢰성을 강화한다.

필수 필드:

```text
source_name
source_type
source_url
original_apply_url
collected_at
last_checked_at
verified_at
verification_status
source_confidence
requires_original_check
```

사용자 화면 표시:

- 원문 보기
- 출처명
- 마지막 확인일
- 수집 방식
- 검수 상태
- 원문 확인 필요 여부
- "최종 신청 가능 여부는 반드시 원문 공고에서 확인" 안내

### P1. 추천 엔진 분리

추천 판정은 단일 점수 기반이 아니라 `Hard Rule`과 `Soft Score`로 분리한다.

Hard Rule 예시:

- 지역
- 학교/캠퍼스
- 학년
- 전공
- 소득구간
- 신청 기간
- 거주기간

Soft Score 예시:

- 우대사항
- 관심 분야
- 보유 역량
- 마감 임박도
- 포트폴리오 가치
- 제출 준비 난이도

`지원불가`는 매우 보수적으로 표시한다. 조건이 검수 완료되었고, 사용자 프로필 정보가 충분하며, 예외 없는 hard rule 불일치가 명확할 때만 사용한다. 그 외에는 `확인필요` 또는 `조건부가능`이 안전하다.

추천 결과 목표 구조:

```text
match_status
match_score
confidence_score
hard_rule_failures
soft_rule_matches
missing_user_fields
ambiguous_rules
source_confidence
explanation_json
```

신뢰도는 다음 세 요소로 분리한다.

```text
user_data_confidence
source_data_confidence
rule_interpretation_confidence
```

### P2. 서류 보관함 버전 관리

현재 공통 서류 보관함은 "준비됨" 편의 상태다. 실서비스에서는 공고별 서류 조건이 다르므로 다음 구조로 확장한다.

```text
documents
- 논리적 서류 슬롯
- 예: 성적증명서, 재학증명서

document_versions
- 실제 파일/발급일/만료일/해시/발급기관을 가진 버전

opportunity_required_documents
- 공고가 요구하는 서류 조건
- 유효기간, 원본 필요 여부, 전용 양식 여부

application_documents
- 특정 지원서에 특정 document_version을 연결한 기록
```

중요 원칙:

- `application_documents`는 `documents.id`가 아니라 `document_versions.id`를 참조한다.
- 제출 완료 시 `snapshot_json`을 저장한다.
- 사용자가 새 서류를 업로드해도 과거 제출 기록은 바뀌지 않는다.

초기 구현은 파일 업로드 없이 메타데이터 중심으로 시작해도 된다.

## 4. 버전/스냅샷 전략

### 규칙 버전

공고 조건은 운영자 수정, AI 재추출, 원문 변경으로 바뀔 수 있다. 따라서 규칙은 버전 관리한다.

```text
eligibility_rules
- id
- opportunity_id
- current_version_id

rule_versions
- id
- rule_id
- opportunity_id
- rule_json
- diff_summary_json
- source_version_id
- created_by
- created_at
```

### 추천 결과 스냅샷

추천 결과도 저장해야 한다.

```text
recommendation_snapshots
- id
- user_id
- opportunity_id
- profile_snapshot_id
- rule_version_id
- source_version_id
- match_status
- match_score
- confidence_score
- explanation_json
- missing_fields_json
- hard_rule_failures_json
- calculated_at
- expires_at
- drift_status
- trigger_event_id
```

`drift_status` 예시:

```text
fresh
stale_rule_changed
stale_profile_changed
stale_source_changed
recalculation_pending
recalculated_changed
recalculated_unchanged
```

규칙이나 프로필이 바뀌면 기존 추천 결과를 삭제하지 않고 stale로 표시한 뒤 재계산한다.

## 5. 이벤트와 재계산 전략

대규모 사용자에게 모든 추천을 즉시 재계산하면 부하가 크다. 따라서 이벤트 기반 하이브리드 재계산을 사용한다.

이벤트 예시:

```text
RULE_CHANGED
PROFILE_CHANGED
SOURCE_CHANGED
DOCUMENT_VERSION_CREATED
APPLICATION_STATUS_CHANGED
DEADLINE_APPROACHING
```

규칙 변경 처리 흐름:

```text
1. 운영자가 eligibility_rules 수정
2. 새 rule_version 생성
3. RULE_CHANGED 이벤트 발행
4. 관련 recommendation_snapshots를 stale 처리
5. impact_analysis job 생성
6. 영향받는 사용자들을 priority queue에 삽입
7. 우선순위 높은 사용자부터 재계산
8. 변경 전/후 diff 생성
9. 의미 있는 변화만 notification_candidate 생성
10. 알림 정책 통과 후 실제 알림 발송
```

재계산 우선순위:

```text
P0
- 저장한 공고
- 마감 D-1~D-3
- 신청 상태가 작성중/서류준비
- 기존 지원가능이 불리하게 바뀔 가능성 있음

P1
- 저장한 공고
- 마감 D-7 이내
- 조건부가능/확인필요 상태

P2
- 고득점 추천
- 최근 앱 접속 사용자

P3
- 일반 추천 사용자
```

## 6. 알림 후보와 피로도 정책

추천 결과가 바뀌었다고 바로 알림을 보내지 않는다. 먼저 `notification_candidates`에 넣고 정책을 적용한다.

```text
notification_candidates
- id
- user_id
- opportunity_id
- event_type
- old_status
- new_status
- severity
- deadline_at
- priority_score
- dedupe_key
- delivery_strategy
- created_at
- scheduled_for
- suppressed_reason
```

기본 알림 정책:

```text
P0: 즉시 발송
P1: 하루 1~2회 묶음 발송
P2: 앱 내부 알림센터에만 표시
P3: 발송하지 않음
```

중복 방지:

```text
dedupe_key = user_id + opportunity_id + event_group + date
```

사용자 설정:

```text
notification_preferences
- user_id
- email_enabled
- push_enabled
- kakao_enabled
- quiet_hours_start
- quiet_hours_end
- max_daily_notifications
- digest_enabled
```

## 7. Evidence-grounded AI 작성 도우미

AI 작성 도우미는 자기소개서를 대신 써주는 대필자가 아니다. 다음 역할로 제한한다.

- 공고 평가 기준 요약
- 제출 문항 분해
- 사용자 경험과 연결할 질문 제공
- 초안 구조 제안
- 빠진 근거 확인
- 과장 표현 경고
- 원문 조건과 불일치하는 내용 경고

LLM 출력은 반드시 공고 원문 또는 사용자 입력 근거와 연결되어야 한다.

예시:

```text
추천 전략:
지역사회 기여 경험을 중심으로 작성하세요.

근거:
- 공고 평가 기준에 "지역사회 공헌"이 포함되어 있음
- 사용자 활동 기록에 "진주 지역 데이터 분석 프로젝트"가 있음

주의:
- 공고문에는 "리더십"이라는 표현이 없으므로 리더십 중심으로 과장하지 않는 것이 좋습니다.
```

## 8. 목표 코드 아키텍처

현재 단일 `server/index.mjs` 구조는 MVP 검증에 적합하다. 실서비스 전환 시 다음 모듈형 구조로 분리한다.

```text
src/
  app.ts

  routes/
    profile.routes.ts
    opportunity.routes.ts
    application.routes.ts
    document.routes.ts
    admin.routes.ts
    notification.routes.ts

  services/
    ProfileService.ts
    OpportunityService.ts
    EligibilityRuleService.ts
    RecommendationService.ts
    DocumentVaultService.ts
    ApplicationService.ts
    NotificationService.ts
    AuditLogService.ts

  events/
    EventBus.ts
    eventTypes.ts
    handlers/

  jobs/
    JobQueue.ts
    workers/
      ImpactAnalysisWorker.ts
      RecommendationRecalcWorker.ts
      NotificationCandidateWorker.ts
      NotificationDeliveryWorker.ts
      DeadlineSchedulerWorker.ts

  repositories/
    UserRepository.ts
    ProfileRepository.ts
    OpportunityRepository.ts
    RuleVersionRepository.ts
    RecommendationSnapshotRepository.ts
    NotificationRepository.ts
    JobRepository.ts
    AuditLogRepository.ts

  domain/
    eligibility/
      evaluateEligibility.ts
      calculateConfidence.ts
      diffRecommendation.ts

    notification/
      calculatePriority.ts
      dedupeNotification.ts
      applyFatiguePolicy.ts

    documents/
      validateDocumentForRequirement.ts

  db/
    schema.sql
    migrations/
```

## 9. 운영자 대시보드 확장

운영자 화면은 검수 큐를 넘어 시스템 상태를 보여줘야 한다.

- Job Queue 상태
- stale snapshot 수
- 추천 재계산 완료/실패 수
- 추천 상태 변경 건수
- notification_candidates 생성/발송/suppressed 수
- suppressed reason 분포
- 최근 rule_version 변경 목록
- 변경 후 영향받은 사용자 수
- 마감 임박 공고 중 stale 상태인 건수
- 소스별 수집 성공률/오류율
- worker heartbeat

## 10. 권장 개발 순서

1. 공고 원문 URL, 출처, 마지막 확인일, 검수 상태 필드 추가
2. 사용자 상세 화면에 원문 확인 안내와 출처 신뢰도 표시
3. 추천 로직에서 Hard Rule과 Soft Score 분리
4. `match_score`와 `confidence_score` 분리
5. 신뢰도 세부값: 사용자 정보, 출처, 규칙 해석
6. 공통 서류 보관함을 documents/document_versions 설계로 개편
7. `application_documents`가 document_versions를 참조하도록 변경
8. 제출 완료 시 document snapshot 저장
9. eligibility_rules/rule_versions 구조 추가
10. recommendation_snapshots 구조 추가
11. rule/profile/source 변경 시 stale 처리
12. DB 기반 events/jobs 테이블 추가
13. ImpactAnalysisWorker 구현
14. RecommendationRecalcWorker 구현
15. NotificationCandidate/DeliveryWorker 구현
16. 사용자용 변경 사유 UI 추가
17. 운영자용 Job Monitoring Dashboard 추가
18. Evidence-grounded AI 작성 도우미 추가
19. PostgreSQL 또는 Supabase 전환
20. 로그인/OAuth 및 RBAC 적용
21. 이메일/웹푸시 알림 적용

## 11. 최종 방향

오퍼가디언은 단순 추천 앱이 아니라 다음 역할을 해야 한다.

> 공고, 프로필, 서류, 규칙의 변화 이벤트를 추적하고, 그 영향도를 우선순위 기반으로 재계산하며, 사용자에게 설명 가능한 상태 변화로 전달하는 실행 관리 시스템.

따라서 앞으로의 핵심 개발 기준은 다음이다.

- 데이터 신뢰성
- 추천 판정 정확성
- 서류 버전 관리
- 규칙 버전 관리
- 추천 결과 스냅샷
- stale 처리
- 우선순위 기반 재계산
- 알림 폭탄 방지
- 사용자에게 설명 가능한 변경 사유
- 운영자 감사 로그
