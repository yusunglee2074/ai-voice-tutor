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

### 1. 관리자 정보
- **주소**: http://localhost:5173/admin

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
상업 API의 경우에는 메이저 중 latency, 가격 등의 이유로 선택하였고, 프론트와 백엔드 모두 오버헤드 최소화를 위해 가벼운 라이브러리를 사용했습니다.
