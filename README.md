## 실행방법

이 프로젝트는 편리한 실행을 위해 `Makefile`을 제공합니다.

### 옵션 1. 로컬 환경에서 실행 (Ruby, Node.js 필요)
```bash
make setup  # 초기 의존성 설치 및 데이터베이스 세팅
make dev    # 프론트엔드와 백엔드 서버 동시 실행
```

### 옵션 2. 도커로 실행 (Docker 설치 필요)
```bash
make docker-up    # 컨테이너 빌드 및 실행
make docker-down  # 컨테이너 중지
```

## 접속정보

### 1. 관리자 정보 (Admin UI, seed 데이터 기준)
- **주소**: http://localhost:5173/admin
- **계정**: admin@example.com / password123

### 2. 프론트 정보
- **주소**: http://localhost:5173

### 3. 백엔드 정보
- **주소**: http://localhost:3000


## 음성 대화 기술 구조도

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              브라우저                                   │
│  ┌──────────────┐                              ┌──────────────────────┐ │
│  │  마이크 입력 │    ──Binary PCM 16kHz──▶     │   오디오 재생        │ │
│  │(AudioWorklet)│                              │ (Web Audio API)      │ │
│  └──────────────┘                              └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
            Raw WebSocket (/ws)      │ ▲
                                    ▼ │
┌─────────────────────────────────────────────────────────────────────────┐
│                           백엔드 서버 (Rails)                           │
│                                                                         │
│   VoiceWebsocketMiddleware → VoiceSession                               │
│        Audio ──▶ STT v3 ──▶ LLM API ──▶ TTS ──▶ JSON Events            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                    │                                   │
                    ▼                                   ▼
            ┌──────────────┐                    ┌──────────────┐
            │  AssemblyAI  │                    │   Cartesia   │
            │  (STT v3)    │                    │  (TTS API)   │
            │ format_turns │                    │   sonic-3    │
            └──────────────┘                    └──────────────┘
```

### 주요 변경사항 (2026-01-04)

**WebSocket 프로토콜 리팩토링:**
- Action Cable → Raw WebSocket (`/ws` 엔드포인트)
- Base64 오디오 전송 → Binary PCM 직접 전송 (33% 페이로드 감소)
- AssemblyAI v2 → v3 (format_turns, force_endpoint 지원)
- 메시지 타입: `finalize_transcript` → `end_of_speech`
- 명시적 상태 머신: `disconnected → idle → recording → processing`

**기술 스택:**
- 프론트엔드: Raw WebSocket API, AudioWorklet, Web Audio API
- 백엔드: faye-websocket (middleware), websocket-client-simple
- STT: AssemblyAI v3 (streaming.assemblyai.com/v3/ws)
- LLM: Google Gemini 2.0 Flash Exp
- TTS: Cartesia sonic-3

자세한 프로토콜 명세는 `AUDIO_SPEC.md` 참조

### 환경 변수 설정

`server/.env` 파일에 다음 API 키를 설정해주세요:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
ASSEMBLY_AI_API_KEY=your_assemblyai_api_key_here
CARTESIA_API_KEY=your_cartesia_api_key_here
```

**API 키 발급:**
- Gemini API: https://aistudio.google.com/app/apikey
- AssemblyAI: https://www.assemblyai.com/
- Cartesia: https://cartesia.ai/
