# 오퍼가디언 서비스형 MVP 실행 가이드

이 버전은 기존 정적 프로토타입을 로컬 서비스형 MVP로 확장한 형태다.

## 실행

```bash
npm install
npm run dev
```

실행 후 접속:

- 웹앱: http://127.0.0.1:5173
- API 헬스체크: http://127.0.0.1:5174/api/health

`npm run dev`는 다음 두 프로세스를 함께 실행한다.

- Vite React 웹앱
- Node.js 로컬 REST API 서버

## 데이터 저장

최초 실행 시 `server/seed.mjs`의 샘플 데이터가 `.data/db.json`으로 복사된다. 이후 사용자가 저장한 공고, 체크리스트, 프로필 수정, 운영자 승인/반려 이력은 `.data/db.json`에 반영된다.

초기화하려면 개발 서버를 종료한 뒤 `.data/db.json`을 삭제하고 다시 실행하면 된다.

## 구현된 MVP 기능

- 사용자 프로필 조회/수정
- 직접 입력 대신 선택형 프로필 입력
- 거주기간, 우선 혜택, 관심/해당 조건 선택
- 공모전 관심 분야, 보유 역량, 팀 참여 성향, 주당 투자 시간 선택
- 프로필 기반 추천 재계산
- 장학금/지원사업 추천 목록
- 공모전/대회 추천 목록 및 적합도 패널
- 추천 근거/확인 필요/주의 조건 표시
- 공고 저장/저장 해제
- 저장 공고 신청서류 체크리스트
- 저장 공고 신청 상태 관리: 검토중, 서류준비, 작성중, 제출완료
- 마감 알림 on/off와 다음 행동 추천
- 대시보드 이번 주 신청 플랜
- 마감 캘린더: 7일, 14일, 30일 구간별 일정 관리
- 공통 서류 보관함: 반복 서류를 한 번 준비하면 관련 저장 공고 체크리스트에 일괄 반영
- 상단 알림센터: 마감 임박, 남은 서류, 알림 예약, 신규 고득점 추천, 운영 검수 대기
- 알림 읽음/전체 읽음 처리
- 운영자 AI 추출 검수 큐
- 운영자 실제 데이터 소스 관리
- 공개 HTML 소스 수집 실행
- API 키 필요 소스 상태 표시
- 크롤러 실행 로그 표시
- 운영자 승인 시 신규 공고 등록 및 추천 반영
- 운영자 반려 처리
- 감사로그 표시
- 로컬 파일 기반 영속 저장

## 주요 API

```text
GET    /api/health
GET    /api/bootstrap
PATCH  /api/me/profile
POST   /api/recommendations/recalculate
PATCH  /api/notifications/:notificationId/read
POST   /api/notifications/read-all
PATCH  /api/documents/:documentName/ready
POST   /api/saved-opportunities
DELETE /api/saved-opportunities/:id
PATCH  /api/applications/:opportunityId/progress
PATCH  /api/applications/:opportunityId/checklist
POST   /api/admin/extractions/:id/approve
POST   /api/admin/extractions/:id/reject
POST   /api/admin/contest-candidates
POST   /api/admin/sources/run
POST   /api/admin/sources/:sourceId/run
```

## 현재 구조

```text
src/
  App.tsx          React 앱, API 연동, 화면 상태
  styles.css      서비스 UI 스타일
server/
  index.mjs       REST API, 추천 엔진, 파일 DB, HTML 수집 커넥터
  seed.mjs        초기 공고/프로필/검수 큐/수집 소스 데이터
scripts/
  dev.mjs         API 서버와 Vite 동시 실행
```

## 신청 실행 루프

추천된 기회를 저장하면 `applications` 상태가 생성된다. 각 저장 공고는 다음 값을 가진다.

- `status`: 검토중, 서류준비, 작성중, 제출완료
- `reminderEnabled`: 마감 알림 설정 여부
- `updatedAt`: 마지막 변경 시각

프론트엔드는 체크된 서류와 신청 상태를 합쳐 다음 행동을 계산한다. 예를 들어 미체크 서류가 있으면 해당 서류 준비를 우선 노출하고, 서류가 모두 준비되면 신청서 작성 또는 제출물 최종 점검을 안내한다.

저장한 기회와 고득점 추천은 마감 캘린더에 표시된다. 캘린더는 7일 내 마감, 8~14일, 15~30일, 30일 이후 저장 기회로 나누어 보여주며, 각 일정에서 상세 보기, 저장, 알림 on/off, 신청 상태 변경을 바로 처리할 수 있다.

## 서류 보관함

저장한 기회에서 요구하는 서류는 `documentVault`로 자동 집계된다. 같은 서류가 여러 공고에서 반복되면 공통 서류로 표시한다.

- `documentVaultReady`: 사용자가 준비 완료로 표시한 공통 서류 목록
- 보관함에서 준비됨 처리: 해당 서류를 요구하는 모든 저장 공고의 체크리스트에 일괄 체크
- 보관함에서 준비 해제: 해당 서류를 요구하는 저장 공고 체크리스트에서 일괄 해제
- 개별 체크리스트 변경: 같은 서류가 필요한 저장 공고가 모두 체크되면 보관함도 준비됨으로 동기화

현재 보관함은 실행형 MVP의 편의 기능이다. 실서비스 전환 시에는 서류 발급일, 만료일, 발급기관, 파일 해시, 공고별 유효기간 조건을 포함하는 `documents` / `document_versions` / `application_documents` 구조로 확장해야 한다. 상세 로드맵은 `ARCHITECTURE_ROADMAP.md`를 기준으로 한다.

## 알림센터

알림은 저장 공고와 추천 결과를 바탕으로 서버에서 계산한다.

- D-7 이하 저장 공고: 마감 임박 알림
- 미체크 서류가 남은 저장 공고: 서류 준비 알림
- 마감 알림을 켠 저장 공고: 알림 예약 상태
- 매칭 점수 86점 이상 미저장 공고: 신규 추천 알림
- 운영 검수 대기 공고: 관리자 알림

읽음 상태는 `readNotificationIds`에 저장한다. 알림 본문은 추천/신청 상태에서 재계산되지만, ID는 공고 기준으로 안정적으로 유지해 읽음 처리가 사라지지 않도록 설계했다.

## 실제 수집 동작

운영 검수 화면에서 `전체 수집` 또는 소스별 `수집` 버튼을 누르면 서버가 `.data/db.json`의 `sources`를 기준으로 수집 작업을 실행한다.

- `API` 소스: 필요한 환경변수가 없으면 `키 필요` 상태와 실패 로그를 남긴다.
- `HTML` 소스: 공개 페이지를 서버에서 fetch하고, 장학/지원/청년/대학생/생활비/주거/연수/공모전/해커톤/대회 같은 키워드가 포함된 링크 후보를 추출해 검수 큐에 넣는다.
- `MANUAL` 소스: 공모전처럼 대형 플랫폼 약관/중복 공고/저작권 이슈가 큰 영역은 운영자가 공식 원문 URL을 등록한 뒤 AI 추출 검수 큐로 넘기는 방식으로 다룬다.
- 운영자가 검수 큐에서 승인하면 신규 공고가 추천 목록에 반영된다.

개발용 HTML 수집은 운영 구조 검증용이다. 프로덕션에서는 robots.txt/이용약관/rate limit/원문 링크 정책을 반드시 별도 점검해야 한다.

## 다음 확장 우선순위

실서비스 전환 로드맵은 `ARCHITECTURE_ROADMAP.md`를 따른다. 다음 개발은 기능 수를 늘리기보다 데이터 신뢰성, 추천 판정 정확성, 서류/규칙 버전 관리, 스냅샷, stale 처리, 알림 피로도 제어를 우선한다.

1. 공고 원문 URL, 출처, 마지막 확인일, 검수 상태 필드 추가
2. 추천 상세에 원문 확인 안내와 출처 신뢰도 표시
3. 추천 로직에서 Hard Rule과 Soft Score 분리
4. `match_score`와 `confidence_score` 분리
5. 공통 서류 보관함을 document version 구조로 개편
6. eligibility rule version과 recommendation snapshot 추가
7. rule/profile/source 변경 시 stale 처리
8. 이벤트/job 기반 우선순위 재계산 도입
9. notification candidate와 알림 피로도 정책 도입
10. Evidence-grounded AI 작성 도우미 추가
11. PostgreSQL 또는 Supabase 전환
12. 로그인/OAuth 및 RBAC 적용
