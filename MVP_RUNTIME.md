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

1. PostgreSQL/Prisma로 파일 DB 교체
2. 실제 인증 추가: 카카오/네이버 OAuth
3. 공모전 공식 URL 등록/검수 화면 고도화
4. 공고 수집 워커 분리
5. Gemini 기반 PDF/HWP/이미지 추출 파이프라인 연결
6. 추천 룰을 DB 스키마로 분리
7. 이메일/웹푸시 알림 발송
8. 관리자 권한/감사로그 강화
