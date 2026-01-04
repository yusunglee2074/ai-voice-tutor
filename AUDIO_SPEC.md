# 링글 대화 오디오 기술 문서

---

## 아키텍처 개요
전체 시스템은 스트리밍 기반의 비동기 파이프라인으로 구성됩니다.
프론트는 React(vite, typescript), 백엔드는 Rails로 구현되고, 이 둘은 오디오 전송을 위해 WebSocket로 연결됩니다.


### 핵심 설계 원칙

1. **스트리밍 우선**: 모든 컴포넌트가 데이터를 점진적으로 스트리밍
2. **비동기 제너레이터**: 조합 가능하고 백프레셔를 인식하는 변환
3. **Producer-Consumer 패턴**: 최대 처리량을 위한 동시 실행
4. 유연성을 위해 STT, TTS, LLM는 변경하기 쉽도록 추상화해서 느슨한 연결 해주세요.

---

## 오디오 캡처 (브라우저)

### AudioWorklet 기반 처리

브라우저의 마이크 입력은 Web Audio API의 AudioWorklet을 사용하여 저지연으로 처리되야합니다.

### 오디오 사양

| 항목 | 값 |
|------|-----|
| 샘플레이트 | 16 kHz (48kHz에서 다운샘플링) |
| 포맷 | 16-bit signed PCM, mono |
| 청크 크기 | 1600 샘플 (100ms) |

### 마이크 설정
echoCancellation(에코 제거), noiseSuppression(노이즈 억제), autoGainControl(자동 게인 조절)

---

## WebSocket 통신

### 브라우저 → 서버

```typescript
// WebSocket 연결 설정
const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
ws.binaryType = "arraybuffer";

// 오디오 청크 전송 (바이너리)
audioCapture.start((chunk: ArrayBuffer) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(chunk);  // 버퍼링 없이 즉시 전송
  }
});
```

### 서버 → 브라우저

서버는 JSON 인코딩된 이벤트를 전송합니다:
```typescript
ws.onmessage = (event) => {
  const data: ServerEvent = JSON.parse(event.data);

  switch (data.type) {
    case "stt_chunk":    // 사용자의 말(Stream)
    case "stt_output":   // 사용자의 말 최종
    case "llm_chunk":    // LLM 응답(Stream)
    case "tts_chunk":    // Base64 인코딩된 PCM 오디오
  }
};
```

---

## STT (Speech-to-Text)

### AssemblyAI 실시간 스트리밍

AssemblyAI의 WebSocket 기반 API를 사용합니다.
웹에서 전달받은 바이너리를 그대로 전달합니다.

---

## LLM 처리
LLM은 STT 출력을 받아 응답을 생성합니다. 스트리밍 모드로 동작하여 토큰 단위로 응답을 전달합니다.

```typescript
async function* llmStream(eventStream: AsyncIterable<LlmEvent>) {
  for await (const event of eventStream) {
    yield event;  // 모든 이벤트 패스스루

    if (event.type === "stt_output") {
      const stream = await llm.stream(event.transcript);

      for await (const chunk of stream) {
        yield { type: "llm_chunk", text: chunk.text, ts: Date.now() };
      }

      yield { type: "llm_end", ts: Date.now() };
    }
  }
}
```

---

## TTS (Text-to-Speech)

### Cartesia TTS

#### 연결 설정

```typescript
const url = "wss://api.cartesia.ai/tts/websocket";
const params = new URLSearchParams({
  api_key: apiKey,
  cartesia_version: "2025-04-16",
});
```

#### 오디오 출력 설정

| 항목 | 값 |
|------|-----|
| 컨테이너 | raw (컨테이너 없음) |
| 인코딩 | pcm_s16le (16-bit little-endian) |
| 샘플레이트 | 24 kHz |

#### 텍스트 전송

```typescript
async sendText(text: string): Promise<void> {
  const payload: CartesiaTTSRequest = {
    model_id: "sonic-3",
    transcript: text,
    voice: { mode: "id", id: this.voiceId },
    output_format: {
      container: "raw",
      encoding: "pcm_s16le",
      sample_rate: 24000,
    },
    language: "en",
    context_id: this._generateContextId(),
  };
  conn.send(JSON.stringify(payload));
}
```

#### 오디오 수신

```typescript
ws.on("message", (data) => {
  const message: CartesiaTTSResponse = JSON.parse(data.toString());

  if (message.data) {
    this._bufferIterator.push({
      type: "tts_chunk",
      audio: message.data,  // Base64 인코딩된 PCM
      ts: Date.now(),
    });
  }
});
```

---

## 오디오 재생 (브라우저)

### 스케줄링 기반 재생

Web Audio API의 정밀한 타이밍을 활용하여 끊김 없는 재생을 구현합니다.

```typescript
let nextPlayTime = 0;

function processQueue(): void {
  while (base64Queue.length > 0) {
    const base64 = base64Queue.shift();

    // 1. Base64 디코딩 → ArrayBuffer
    const arrayBuffer = pcmBase64ToArrayBuffer(base64);

    // 2. PCM → AudioBuffer 변환
    const audioBuffer = createAudioBuffer(arrayBuffer);

    // 3. AudioBufferSourceNode 생성 및 연결
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    // 4. 정확한 시점에 재생 스케줄링
    if (nextPlayTime < ctx.currentTime) {
      nextPlayTime = ctx.currentTime;  // 지연 시 현재 시간으로 리셋
    }

    source.start(nextPlayTime);
    nextPlayTime += audioBuffer.duration;  // 다음 청크 시작 시간
  }
}
```

### 오디오 변환

```typescript
// Base64 → ArrayBuffer
function pcmBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// PCM Int16 → Float32 AudioBuffer
function createAudioBuffer(arrayBuffer: ArrayBuffer): AudioBuffer {
  const view = new DataView(arrayBuffer);
  const samples = arrayBuffer.byteLength / 2;
  const audioBuffer = ctx.createBuffer(1, samples, 24000);
  const channel = audioBuffer.getChannelData(0);

  for (let i = 0; i < samples; i++) {
    const int16 = view.getInt16(i * 2, true);  // little-endian
    channel[i] = int16 / 32768;  // 정규화
  }

  return audioBuffer;
}
```

---

## 반응성 최적화

### 1. 동시 Producer-Consumer 패턴

각 파이프라인 스테이지에서 Producer와 Consumer가 동시에 실행됩니다:

```typescript
async function* sttStream(audioStream: AsyncIterable<Uint8Array>) {
  const stt = new AssemblyAISTT();
  const passthrough = writableIterator<VoiceEvent>();

  // Producer: 오디오를 STT로 전송 (비동기)
  const producer = iife(async () => {
    for await (const audioChunk of audioStream) {
      await stt.sendAudio(audioChunk);
    }
  });

  // Consumer: STT 이벤트 수신 (비동기)
  const consumer = iife(async () => {
    for await (const event of stt.receiveEvents()) {
      passthrough.push(event);
    }
  });

  // 동시 실행
  yield* passthrough;
  await Promise.all([producer, consumer]);
}
```

**이점**: 오디오 전송과 전사 수신이 병렬로 진행되어 순차적 병목 제거

### 2. 모든 레이어에서의 스트리밍

| 구간 | 스트리밍 방식 |
|------|-------------|
| 브라우저 → 서버 | 100ms 청크 즉시 전송 |
| 서버 → AssemblyAI | 바이너리 직접 전송 |
| AssemblyAI → 서버 | 부분 전사 스트리밍 |
| LLM | 토큰 단위 스트리밍 |
| 서버 → Cartesia | 완성된 텍스트 전송 |
| Cartesia → 브라우저 | 오디오 청크 스트리밍 |

### 3. Zero-Copy 전송

- 브라우저 AudioWorklet
- AssemblyAI 바이너리 전송

### 4. 끊김 없는 오디오 재생

```typescript
// Web Audio API의 정밀한 스케줄링
source.start(nextPlayTime);
nextPlayTime += audioBuffer.duration;

// 지연 발생 시 자동 복구
if (nextPlayTime < ctx.currentTime) {
  nextPlayTime = ctx.currentTime;
}
```

### 6. 샘플레이트 전략

| 구간 | 샘플레이트 | 이유 |
|------|-----------|------|
| 입력 (STT) | 16 kHz | STT 품질을 위한 최소 요구사항 |
| 출력 (TTS) | 24 kHz | 품질과 대역폭의 균형 |

리샘플링은 브라우저 AudioWorklet에서 실시간 처리 (서버 부하 없음)

---

## 이벤트 타입

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

---

