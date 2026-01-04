# Ringle 프로젝트 TODO

---

## Phase 1: 데이터베이스 및 모델 (Foundation) ✅

### 1.1 DB 마이그레이션 ✅
- [x] `users` 테이블 생성 (id, email, name, timestamps)
- [x] `membership_types` 테이블 생성 (id, name, features, duration_days, price, timestamps)
- [x] `user_memberships` 테이블 생성 (id, user_id, membership_type_id, valid_from, valid_to, status, timestamps)
- [x] 외래 키 및 인덱스 설정

### 1.2 모델 구현 ✅
- [x] User 모델 (유효성 검사, 연관 관계)
- [x] MembershipType 모델 (features JSON 처리)
- [x] UserMembership 모델 (상태 관리, 만료 로직)
- [x] 멤버십 만료 자동 처리 로직 (valid_to 기준 status → expired)

### 1.3 Seed 데이터 ✅
- [x] 관리자 계정 (admin@example.com)
- [x] 테스트용 멤버십 유형
- [x] 테스트용 사용자

### 1.4 모델 테스트 (RSpec)
- [x] User 모델 테스트
- [x] MembershipType 모델 테스트
- [x] UserMembership 모델 테스트 (만료 로직 포함)

---

## Phase 2: 관리자 기능 (Back Office) ✅

### 2.1 관리자 API (Rails) ✅
- [x] `GET /api/v1/admin/membership_types` - 목록 조회
- [x] `POST /api/v1/admin/membership_types` - 생성
- [x] `PUT /api/v1/admin/membership_types/:id` - 수정
- [x] `DELETE /api/v1/admin/membership_types/:id` - 삭제
- [x] `GET /api/v1/admin/users` - 사용자 목록 (검색, 페이지네이션)
- [x] `GET /api/v1/admin/users/:user_id` - 사용자 상세
- [x] `GET /api/v1/admin/users/:user_id/memberships` - 사용자 멤버십 목록
- [x] `POST /api/v1/admin/users/:user_id/memberships` - 멤버십 부여
- [x] `DELETE /api/v1/admin/users/:user_id/memberships/:id` - 멤버십 삭제

### 2.2 관리자 API 테스트 (RSpec)
- [x] 멤버십 유형 CRUD 테스트
- [x] 사용자 관리 API 테스트

### 2.3 관리자 UI (React) ✅
- [x] `/admin` 라우팅 설정
- [x] 관리자 대시보드 페이지
- [x] `/admin/membership-types` - 멤버십 유형 목록 테이블
- [x] 멤버십 유형 생성/수정 모달
- [x] `/admin/users` - 사용자 검색 및 목록
- [x] `/admin/users/:id` - 사용자 상세 (멤버십 부여/삭제)

### 2.4 관리자 UI 테스트 (Vitest)
- [x] 멤버십 유형 관리 컴포넌트 테스트
- [x] 사용자 관리 컴포넌트 테스트

---

## Phase 3: 사용자 멤버십 기능 (The Gatekeeper) ✅

### 3.1 공개 API (Rails) ✅
- [x] `GET /api/v1/membership_types` - 멤버십 유형 목록
- [x] `GET /api/v1/membership_types/:id` - 멤버십 유형 상세
- [x] `GET /api/v1/users/:user_id/memberships` - 사용자 멤버십 조회

### 3.2 사용자 식별 (Mock Auth) ✅
- [x] user_id 기반 사용자 식별 로직 (실제 인증 없이)
- [x] 멤버십 상태 확인 (active/expired/cancelled)

### 3.3 사용자 UI (React) ✅
- [x] `/` 홈 페이지 - 멤버십 상태 표시
- [x] `/memberships` 멤버십 페이지
- [x] 대화 페이지 접근 전 멤버십 검증 (Route Guard)
- [x] TanStack Query 설정 및 API 연동

### 3.4 사용자 UI 테스트 (Vitest)
- [x] 홈 페이지 컴포넌트 테스트
- [x] Route Guard 테스트

---

## Phase 4: 오디오 파이프라인 - 백엔드 (The Core - Backend) ✅

### 4.1 외부 API 연동 모듈
- [x] AssemblyAI STT Service (WebSocket 기반 실시간 스트리밍)
- [x] LLM Service (스트리밍 응답)
- [x] Cartesia TTS Service (WebSocket 기반, 24kHz PCM)
- [x] 각 서비스 추상화 (느슨한 결합)

### 4.2 WebSocket 서버
- [x] WebSocket 엔드포인트 설정 (`/ws`)
- [x] 바이너리 오디오 수신 처리
- [x] JSON 이벤트 전송 (stt_chunk, stt_output, llm_chunk, tts_chunk)

### 4.3 스트리밍 파이프라인
- [x] Producer-Consumer 패턴 구현
- [x] Async Generator 기반 데이터 흐름
- [x] Audio → STT → LLM → TTS → Client 파이프라인

### 4.4 대화 컨텍스트 관리
- [x] WebSocket 연결 직후 AI 초기 인사말(Greeting) 자동 전송 로직
- [x] 세션별 대화 히스토리 메모리 저장
- [x] LLM 요청 시 컨텍스트 주입
- [x] 세션 종료 시 메모리 정리

### 4.5 백엔드 오디오 테스트 (RSpec)
- [ ] STT Service 테스트
- [ ] LLM Service 테스트
- [ ] TTS Service 테스트
- [ ] WebSocket 핸들러 테스트

---

## Phase 5: 오디오 파이프라인 - 프론트엔드 (The Core - Frontend) ✅

### 5.1 오디오 캡처 (AudioWorklet)
- [x] AudioWorklet Processor 구현
- [x] 48kHz → 16kHz 다운샘플링
- [x] 16-bit signed PCM, mono 변환
- [x] 100ms (1600 샘플) 청크 단위 처리
- [x] 마이크 설정 (echoCancellation, noiseSuppression, autoGainControl)

### 5.2 WebSocket 클라이언트
- [x] WebSocket 연결 관리
- [x] 바이너리 오디오 청크 전송
- [x] JSON 이벤트 수신 및 처리
- [x] 연결 상태 관리 (연결/재연결/에러)

### 5.3 오디오 재생 (Web Audio API)
- [x] Base64 → ArrayBuffer 디코딩
- [x] PCM Int16 → Float32 AudioBuffer 변환
- [x] 스케줄링 기반 끊김 없는 재생
- [x] 재생 큐 관리

### 5.4 대화 UI (`/conversation`)
- [x] 마이크 버튼 (녹음 시작/중지)
- [x] "답변 완료" 버튼 (STT 확정 → LLM 요청 트리거)
- [x] 음성 인식 중 파형 시각화
- [x] AI 응답 텍스트 표시 (스트리밍)
- [x] 상태 표시 (녹음 중, AI 생각 중, AI 말하는 중)

### 5.5 프론트엔드 오디오 테스트 (Vitest)
- [ ] AudioWorklet 로직 테스트
- [ ] WebSocket 클라이언트 테스트
- [ ] 오디오 재생 로직 테스트
- [x] 대화 UI 컴포넌트 테스트

---

## Phase 6: 통합 및 안정화 (Refinement)

### 6.1 End-to-End 테스트
- [ ] 관리자 멤버십 부여 → 사용자 대화 진입 흐름
- [ ] 전체 오디오 송수신 흐름 테스트

### 6.2 Rate Limiting
- [ ] IP 기반 Rate Limiting 구현

### 6.3 UX 개선
- [ ] 로딩 상태 처리
- [ ] 에러 핸들링 및 사용자 피드백
- [ ] 반응형 UI

### 6.4 Docker 설정
- [ ] Dockerfile 작성
- [ ] docker-compose.yml 작성
- [ ] `make docker-up/down` 명령어 확인

### 6.5 문서화
- [ ] API 문서 정리
- [ ] 환경 변수 설정 가이드

---

## 참고: 이벤트 타입 정의

```typescript
type VoiceEvent =
  // STT 스테이지
  | { type: "user_input"; audio: Uint8Array; ts: number }
  | { type: "stt_chunk"; transcript: string; ts: number }
  | { type: "stt_output"; transcript: string; ts: number }

  // LLM 스테이지
  | { type: "llm_chunk"; text: string; ts: number }
  | { type: "llm_end"; ts: number }

  // TTS 스테이지
  | { type: "tts_chunk"; audio: string; ts: number }  // Base64 PCM
```

## 참고: 오디오 사양

| 구간 | 샘플레이트 | 포맷 |
|------|-----------|------|
| 입력 (브라우저 → 서버) | 16 kHz | 16-bit signed PCM, mono |
| 출력 (서버 → 브라우저) | 24 kHz | 16-bit little-endian PCM |
