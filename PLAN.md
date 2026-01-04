# Ringle

Ringle은 AI 튜터 기반 영어 학습 플랫폼입니다. 사용자가 AI와의 실시간 대화가 주요 기능입니다.

## 기능

### 백엔드 (멤버십)
* 관리자가 다양한 멤버십 유형을 생성/삭제할 수 있음
* 멤버십은 만료일이 있으며, 만료 시 사용 불가
* 멤버십 유형은 세 가지 기능의 조합으로 정의됨:
  * "학습" 기능: 학습 자료를 따라 AI와 학습
  * "대화" 기능: AI와 대화
  * "분석" 기능: AI와의 대화를 기반으로 레벨 분석
* 관리자는 사용자에게 멤버십을 부여/삭제할 수 있음

### 프론트엔드 - 사용자 (AI 대화 & 멤버십 조회)
* 홈 화면에서 현재 멤버십 상태 확인
* 대화 화면 접근 전 멤버십 존재 여부 확인
* AI가 먼저 대화를 시작함
* 마이크 버튼으로 사용자 음성 인식
* 음성 인식 중 파형 등 UX 피드백 제공
* "답변 완료" 버튼으로 사용자 발화 텍스트 생성 및 AI 응답 생성

### 프론트엔드 - 관리자 UI
* 멤버십 유형 관리
  * 멤버십 유형 목록 조회 (이름, 기능, 유효기간, 가격)
  * 새로운 멤버십 유형 생성 폼
  * 기존 멤버십 유형 삭제
* 사용자 멤버십 관리
  * 사용자 목록 조회 및 검색
  * 특정 사용자의 멤버십 현황 조회
  * 사용자에게 멤버십 부여 (멤버십 유형 선택)
  * 사용자 멤버십 삭제/취소

## 기술 스택

### 백엔드
* Ruby on Rails (API 모드)
* Sqlite
* RSpec (테스트)

### 프론트엔드
* TypeScript
* React (Vite)
* Tailwind CSS
* TanStack Query (서버 상태 관리)
* React Router Dom (라우팅)
* Vitest (테스트)
* Prettier + ESLint (포맷팅/린트)
* Browser Websocket

## 기술 결정 사항

### 대화 세션 관리
* 대화 컨텍스트는 메모리에 유지

### 관리자 권한 처리
* 관리자 Authentication, Authroization 무시(모두 허용).
* 관리자 API 엔드포인트는 `/api/v1/admin/` 접두사 사용
* 프론트엔드에서 관리자 UI는 `/admin` 경로로 분리

## 데이터베이스 스키마

### users (사용자)
* id (기본 키)
* email (이메일, 고유)
* name (이름)
* created_at (생성일시)
* updated_at (수정일시)

### membership_types (멤버십 유형)
* id (기본 키)
* name (멤버십 이름)
* features (기능 목록, '["학습", "대화", "분석"]')
* duration_days (유효 기간)
* price (가격)
* created_at (생성일시)
* updated_at (수정일시)

### user_memberships (사용자 멤버십)
* id (기본 키)
* user_id (사용자 외래 키)
* membership_type_id (멤버십 유형 외래 키)
* valid_from (시작일시)
* valid_to (만료일시)
* status (상태: active, expired, cancelled)
* created_at (생성일시)
* updated_at (수정일시)

## API 인터페이스

* 모든 API 엔드포인트는 `/api/v1/` 접두사 사용
* JSON 요청/응답
* IP 기반 Rate Limiting 적용

### 멤버십 유형 API
* `GET /api/v1/membership_types` - 멤버십 유형 목록 조회
* `GET /api/v1/membership_types/:id` - 멤버십 유형 상세 조회

### 사용자 멤버십 API
* `GET /api/v1/users/:user_id/memberships` - 사용자 멤버십 조회

### 대화세션 API
* 클라이언트 브라우저에 메모리에 저장

### 관리자 API
* `POST /api/v1/admin/membership_types` - 멤버십 유형 생성
* `PUT /api/v1/admin/membership_types/:id` - 멤버십 유형 수정
* `DELETE /api/v1/admin/membership_types/:id` - 멤버십 유형 삭제
* `GET /api/v1/admin/users` - 사용자 목록 조회 (검색, 페이지네이션)
* `GET /api/v1/admin/users/:user_id` - 사용자 상세 조회
* `GET /api/v1/admin/users/:user_id/memberships` - 사용자 멤버십 목록 조회
* `POST /api/v1/admin/users/:user_id/memberships` - 사용자에게 멤버십 부여
* `DELETE /api/v1/admin/users/:user_id/memberships/:id` - 사용자 멤버십 삭제

## 페이지 구조

### 사용자 페이지
* `/` - 홈 (멤버십 상태 확인, 구매)
* `/memberships` - 멤버십 구매 페이지
* `/conversation` - AI 대화 페이지

### 관리자 페이지
* `/admin` - 관리자 대시보드
* `/admin/membership-types` - 멤버십 유형 관리
  * 멤버십 유형 목록 테이블
  * 생성/수정 모달
* `/admin/users` - 사용자 관리
  * 사용자 검색 및 목록
* `/admin/users/:id` - 사용자 상세
  * 사용자 정보
  * 보유 멤버십 목록
  * 멤버십 부여/삭제 기능

## 테스트 전략

### 백엔드 (RSpec)
* 모델 테스트: 유효성 검사, 스코프, 메서드
* 컨트롤러 테스트: API 엔드포인트, 응답 형식
* 서비스 테스트: 비즈니스 로직, 엣지 케이스
* 관리자 API 테스트: 권한 검증, CRUD 동작

### 프론트엔드 (Vitest)
* 컴포넌트 테스트: 렌더링, 사용자 상호작용
* 훅 테스트: 커스텀 훅 로직
* 관리자 UI 테스트: 폼 제출, 테이블 동작

## 제외된 요구사항
* 실제 PG 결제 API 연동
* 로그인/회원가입 인증 로직
* 대화 세션
* 어드민 Auth
* 결제
