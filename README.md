## 실행방법

### 옵션 1. 로컬 환경에서 실행 (Ruby, Node.js 필요)
```bash
make setup  # 초기 의존성 설치 및 데이터베이스 세팅
make dev    # 프론트엔드와 백엔드 서버 동시 실행
make test   # 전체 테스트 실행 (프론트 + 백엔드)
make test-sever
make test-web
```

### 옵션 2. 도커로 실행 (Docker 설치 필요)
```bash
make docker-up    # 컨테이너 빌드 및 실행
make docker-down  # 컨테이너 중지
```

## 접속정보

- **프론트엔드**: http://localhost:5173
- **백엔드 API**: http://localhost:3000


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
│        Audio ──▶ STT     ──▶ LLM API ──▶ TTS ──▶ JSON Events            │
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

**기술 스택:**
- 프론트엔드: Raw WebSocket API, AudioWorklet, Web Audio API
- 백엔드: faye-websocket, websocket-client-simple
- STT: AssemblyAI v3
- LLM: Google Gemini 2.5 Flash Lite
- TTS: Cartesia sonic-3

**실시간 대화 특징:**
- Full-duplex 양방향 통신으로 자연스러운 대화 경험
- AssemblyAI의 `format_turns` 기능으로 발화 종료 자동 감지
- 사용자가 말하는 동안 AI 응답 중단(interrupt) 지원
- 버튼 조작 없이 자동으로 대화 진행
