# Voice WebSocket 프로토콜 기술 문서

## 개요

실시간 음성 대화 시스템의 WebSocket 프로토콜 명세입니다.  
음성 입력 → STT → LLM → TTS 파이프라인을 구현합니다.

**동작 방식:** Push-to-Talk (PTT)
- 사용자가 녹음 버튼을 눌러 음성 녹음 시작
- 녹음 완료 버튼을 눌러 서버에 전송 완료 신호

---

## 1. 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                         클라이언트 (Web)                          │
├─────────────────────────────────────────────────────────────────┤
│  [녹음] 버튼 → 마이크 → PCM 16kHz → WebSocket 전송               │
│  [완료] 버튼 → end_of_speech 이벤트 전송                          │
│  <────────────────── WebSocket → JSON 이벤트 → 오디오 재생       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ ws:// 또는 wss://
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                            서버 (Rails)                          │
├─────────────────────────────────────────────────────────────────┤
│  오디오 수신 → STT (AssemblyAI) → LLM (Claude) → TTS (Cartesia) │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. WebSocket 연결

**엔드포인트:** `/ws`

```
ws://{host}/ws
wss://{host}/ws  (HTTPS)
```

> **Note:** Rails에서 raw WebSocket을 사용합니다 (Action Cable이 아님).

---

## 3. 메시지 프로토콜

### 3.1 클라이언트 → 서버

| 형식 | 타입 | 설명 |
|------|------|------|
| Binary | `ArrayBuffer` | PCM 오디오 (16kHz, 16-bit signed LE, mono) |
| JSON | `{ type: "end_of_speech" }` | 녹음 완료 신호 |

**오디오 청크 크기:** 1,600 샘플 (100ms)

### 3.2 서버 → 클라이언트

모든 이벤트는 JSON 문자열로 전송됩니다.

---

## 4. 이벤트 타입

### 공통 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `type` | `string` | 이벤트 타입 |
| `ts` | `number` | 타임스탬프 (ms, Unix epoch) |

### 4.1 클라이언트 → 서버 이벤트

#### `end_of_speech` - 녹음 완료

사용자가 녹음 완료 버튼을 눌렀을 때 전송합니다.

```json
{ "type": "end_of_speech" }
```

### 4.2 서버 → 클라이언트 이벤트

#### `stt_chunk` - 부분 전사 (실시간)

```json
{ "type": "stt_chunk", "ts": 1704355200000, "transcript": "안녕하세" }
```

#### `stt_output` - 최종 전사

```json
{ "type": "stt_output", "ts": 1704355201000, "transcript": "안녕하세요." }
```

#### `llm_chunk` - LLM 응답 스트리밍

```json
{ "type": "llm_chunk", "ts": 1704355202000, "text": "안녕하세요!" }
```

#### `llm_end` - LLM 응답 완료

```json
{ "type": "llm_end", "ts": 1704355203000 }
```

#### `tts_chunk` - 음성 합성 오디오

```json
{ "type": "tts_chunk", "ts": 1704355204000, "audio": "base64..." }
```

**TTS 오디오 포맷:** 24kHz, 16-bit signed little-endian, mono, Base64 인코딩

#### `error` - 에러

```json
{ "type": "error", "ts": 1704355205000, "message": "STT connection failed" }
```

---

## 5. 이벤트 흐름 (Push-to-Talk)

```
클라이언트                         서버
    │                               │
    │  [녹음 버튼 클릭]               │
    │── Binary (PCM) ──────────────>│
    │── Binary (PCM) ──────────────>│
    │<── stt_chunk ─────────────────│  (실시간 피드백)
    │── Binary (PCM) ──────────────>│
    │<── stt_chunk ─────────────────│
    │                               │
    │  [완료 버튼 클릭]               │
    │── { type: "end_of_speech" } ─>│
    │                               │  STT 최종 처리
    │<── stt_output ────────────────│
    │                               │  LLM 처리
    │<── llm_chunk ─────────────────│
    │<── llm_chunk ─────────────────│
    │<── llm_end ───────────────────│
    │                               │  TTS 처리
    │<── tts_chunk ─────────────────│
    │<── tts_chunk ─────────────────│
    │                               │
    │  [다음 녹음 버튼 클릭]           │
    │── Binary (PCM) ──────────────>│
    │   ...                         │
```

---

## 6. 타입 정의

### TypeScript (클라이언트)

```typescript
// 클라이언트 → 서버
type ClientEvent = { type: "end_of_speech" };

// 서버 → 클라이언트
type ServerEvent =
  | { type: "stt_chunk"; ts: number; transcript: string }
  | { type: "stt_output"; ts: number; transcript: string }
  | { type: "llm_chunk"; ts: number; text: string }
  | { type: "llm_end"; ts: number }
  | { type: "tts_chunk"; ts: number; audio: string }
  | { type: "error"; ts: number; message: string };
```

### Ruby (서버)

```ruby
def emit(type, **data)
  { type: type, ts: (Time.now.to_f * 1000).to_i, **data }
end
```

---

## 7. 프론트엔드 구현 가이드

### 7.1 오디오 캡처 (마이크 → PCM 16kHz)

```typescript
const workletCode = `
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.resampleRatio = sampleRate / 16000;
    this.resampleIndex = 0;
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;

    for (let i = 0; i < input.length; i++) {
      this.resampleIndex += 1;
      if (this.resampleIndex >= this.resampleRatio) {
        this.resampleIndex -= this.resampleRatio;
        const sample = Math.max(-1, Math.min(1, input[i]));
        const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        this.buffer.push(int16);
      }
    }

    const CHUNK_SIZE = 1600;
    while (this.buffer.length >= CHUNK_SIZE) {
      const chunk = this.buffer.splice(0, CHUNK_SIZE);
      const int16Array = new Int16Array(chunk);
      this.port.postMessage(int16Array.buffer, [int16Array.buffer]);
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
`;

export function createAudioCapture() {
  let audioContext: AudioContext | null = null;
  let workletNode: AudioWorkletNode | null = null;
  let mediaStream: MediaStream | null = null;

  return {
    async start(onChunk: (data: ArrayBuffer) => void) {
      audioContext = new AudioContext();
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      await audioContext.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);

      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });

      const source = audioContext.createMediaStreamSource(mediaStream);
      workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
      workletNode.port.onmessage = (e) => onChunk(e.data);
      source.connect(workletNode);
    },

    stop() {
      workletNode?.disconnect();
      mediaStream?.getTracks().forEach(t => t.stop());
      workletNode = null;
      mediaStream = null;
    }
  };
}
```

### 7.2 오디오 재생 (Base64 PCM → 스피커)

```typescript
const TTS_SAMPLE_RATE = 24000;

export function createAudioPlayback() {
  let audioContext: AudioContext | null = null;
  let nextPlayTime = 0;

  return {
    play(base64: string) {
      if (!audioContext) {
        audioContext = new AudioContext({ sampleRate: TTS_SAMPLE_RATE });
      }
      if (audioContext.state === 'suspended') audioContext.resume();

      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const view = new DataView(bytes.buffer);
      const numSamples = bytes.length / 2;
      const audioBuffer = audioContext.createBuffer(1, numSamples, TTS_SAMPLE_RATE);
      const channel = audioBuffer.getChannelData(0);
      for (let i = 0; i < numSamples; i++) {
        channel[i] = view.getInt16(i * 2, true) / 32768;
      }

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);

      if (nextPlayTime < audioContext.currentTime) nextPlayTime = audioContext.currentTime;
      source.start(nextPlayTime);
      nextPlayTime += audioBuffer.duration;
    },

    stop() { nextPlayTime = 0; }
  };
}
```

### 7.3 Push-to-Talk 세션 관리

```typescript
type SessionState = 'disconnected' | 'idle' | 'recording' | 'processing';

export function createVoiceSession() {
  let ws: WebSocket | null = null;
  let state: SessionState = 'disconnected';
  const capture = createAudioCapture();
  const playback = createAudioPlayback();
  let onStateChange: ((state: SessionState) => void) | null = null;

  function setState(newState: SessionState) {
    state = newState;
    onStateChange?.(state);
  }

  return {
    connect(onEvent: (event: ServerEvent) => void, stateCallback: (state: SessionState) => void) {
      onStateChange = stateCallback;
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${location.host}/ws`);
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => setState('idle');

      ws.onmessage = (e) => {
        const event: ServerEvent = JSON.parse(e.data);
        onEvent(event);

        if (event.type === 'tts_chunk') playback.play(event.audio);
        if (event.type === 'llm_end') setState('idle');
        if (event.type === 'error') setState('idle');
      };

      ws.onerror = () => setState('disconnected');
      ws.onclose = () => setState('disconnected');
    },

    async startRecording() {
      if (state !== 'idle' || !ws || ws.readyState !== WebSocket.OPEN) return;
      
      playback.stop();
      try {
        await capture.start((chunk) => {
          if (ws?.readyState === WebSocket.OPEN) ws.send(chunk);
        });
        setState('recording');
      } catch (err) {
        console.error('Microphone access denied:', err);
      }
    },

    stopRecording() {
      if (state !== 'recording' || !ws) return;
      capture.stop();
      ws.send(JSON.stringify({ type: 'end_of_speech' }));
      setState('processing');
    },

    disconnect() {
      capture.stop();
      playback.stop();
      ws?.close();
      ws = null;
      setState('disconnected');
    },

    getState: () => state
  };
}
```

### 7.4 React 컴포넌트 예시

```tsx
import { useState, useRef, useEffect } from 'react';
import { createVoiceSession, type ServerEvent, type SessionState } from './voice';

export function VoiceChat() {
  const [state, setState] = useState<SessionState>('disconnected');
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const sessionRef = useRef(createVoiceSession());

  useEffect(() => {
    const session = sessionRef.current;
    session.connect(
      (event) => {
        switch (event.type) {
          case 'stt_chunk': setTranscript(event.transcript); break;
          case 'stt_output': setTranscript(event.transcript); setResponse(''); break;
          case 'llm_chunk': setResponse(prev => prev + event.text); break;
          case 'error': alert(event.message); break;
        }
      },
      setState
    );
    return () => session.disconnect();
  }, []);

  const handleButton = async () => {
    const session = sessionRef.current;
    if (state === 'idle') {
      await session.startRecording();
    } else if (state === 'recording') {
      session.stopRecording();
    }
  };

  return (
    <div>
      <button onClick={handleButton} disabled={state === 'processing' || state === 'disconnected'}>
        {state === 'disconnected' && '연결 중...'}
        {state === 'idle' && '🎤 녹음'}
        {state === 'recording' && '✅ 완료'}
        {state === 'processing' && '⏳ 처리중...'}
      </button>
      <p><strong>나:</strong> {transcript}</p>
      <p><strong>AI:</strong> {response}</p>
    </div>
  );
}
```

---

## 8. Rails 서버 구현 가이드

### 8.1 Gemfile

```ruby
gem 'faye-websocket'          # Raw WebSocket 지원
gem 'websocket-client-simple' # 외부 WebSocket 연결용
gem 'anthropic'
gem 'puma'                    # Rack hijack 지원 필요
```

### 8.2 Middleware (Raw WebSocket)

Action Cable 대신 `faye-websocket`을 사용하여 raw WebSocket을 처리합니다.

```ruby
# lib/voice_websocket_middleware.rb
require 'faye/websocket'

class VoiceWebsocketMiddleware
  def initialize(app)
    @app = app
  end

  def call(env)
    if Faye::WebSocket.websocket?(env) && env['PATH_INFO'] == '/ws'
      ws = Faye::WebSocket.new(env)
      session = VoiceSession.new(ws)

      ws.on :open do |_|
        session.start
      end

      ws.on :message do |event|
        session.handle_message(event.data)
      end

      ws.on :close do |_|
        session.stop
      end

      ws.rack_response
    else
      @app.call(env)
    end
  end
end
```

### 8.3 VoiceSession 클래스

```ruby
# app/services/voice_session.rb
class VoiceSession
  def initialize(ws)
    @ws = ws
    @stt = nil
    @tts = nil
    @messages = []
    @current_transcript = ''
  end

  def start
    @stt = AssemblyAIClient.new
    @tts = CartesiaClient.new

    # STT 이벤트 리스너
    @stt.on_event do |event|
      send_event(event)
      if event[:type] == 'stt_output'
        @current_transcript = event[:transcript]
      end
    end

    # TTS 이벤트 리스너
    @tts.on_event { |event| send_event(event) }
  end

  def handle_message(data)
    if data.is_a?(Array) || data.encoding == Encoding::BINARY
      # 바이너리 오디오 데이터
      @stt&.send_audio(data)
    else
      # JSON 메시지
      begin
        msg = JSON.parse(data)
        handle_end_of_speech if msg['type'] == 'end_of_speech'
      rescue JSON::ParserError
        # 바이너리로 처리
        @stt&.send_audio(data)
      end
    end
  end

  def stop
    @stt&.close
    @tts&.close
  end

  private

  def handle_end_of_speech
    # STT에 강제 종료 신호 전송
    @stt&.force_endpoint

    # 최종 전사 대기 후 LLM 처리
    Thread.new do
      sleep 0.5  # 최종 전사 대기
      process_llm(@current_transcript) if @current_transcript.present?
      @current_transcript = ''
    end
  end

  def process_llm(transcript)
    @messages << { role: 'user', content: transcript }
    response = ''

    client = Anthropic::Client.new
    client.messages(
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 512,
      system: 'You are a helpful sandwich shop assistant. Be concise.',
      messages: @messages,
      stream: proc { |chunk|
        if chunk['type'] == 'content_block_delta'
          text = chunk.dig('delta', 'text') || ''
          response += text
          send_event(type: 'llm_chunk', text: text)
        end
      }
    )

    @messages << { role: 'assistant', content: response }
    send_event(type: 'llm_end')
    @tts&.send_text(response)
  rescue => e
    send_event(type: 'error', message: e.message)
  end

  def send_event(event)
    return unless @ws
    event = { ts: (Time.now.to_f * 1000).to_i }.merge(event)
    @ws.send(event.to_json)
  end
end
```

### 8.4 AssemblyAI 클라이언트 (STT)

**API 버전:** v3  
**엔드포인트:** `wss://streaming.assemblyai.com/v3/ws`

```ruby
# app/services/assembly_ai_client.rb
require 'websocket-client-simple'

class AssemblyAIClient
  URL = "wss://streaming.assemblyai.com/v3/ws"

  def initialize(sample_rate: 16000)
    @callbacks = []
    @mutex = Mutex.new
    connect(sample_rate)
  end

  def send_audio(bytes)
    return unless @ws&.open?
    @ws.send(bytes, type: :binary)
  end

  # AssemblyAI에 강제 엔드포인트 신호 전송
  def force_endpoint
    return unless @ws&.open?
    @ws.send({ type: 'force_endpoint' }.to_json)
  end

  def on_event(&block)
    @mutex.synchronize { @callbacks << block }
  end

  def close
    @ws&.close
  end

  private

  def connect(sample_rate)
    params = URI.encode_www_form(
      sample_rate: sample_rate,
      format_turns: true
    )

    @ws = WebSocket::Client::Simple.connect(
      "#{URL}?#{params}",
      headers: { 'Authorization' => ENV['ASSEMBLYAI_API_KEY'] }
    )

    @ws.on(:message) do |msg|
      handle(JSON.parse(msg.data))
    rescue JSON::ParserError => e
      Rails.logger.error("AssemblyAI parse error: #{e}")
    end

    @ws.on(:error) { |e| Rails.logger.error("AssemblyAI error: #{e}") }
  end

  def handle(data)
    return unless data['type'] == 'Turn'

    event = if data['turn_is_formatted']
      { type: 'stt_output', transcript: data['transcript'] }
    else
      { type: 'stt_chunk', transcript: data['transcript'] }
    end

    return if event[:transcript].blank?
    @mutex.synchronize { @callbacks.each { |cb| cb.call(event) } }
  end
end
```

**AssemblyAI 클라이언트 메시지:**

| 메시지 | 설명 |
|--------|------|
| `{ type: "force_endpoint" }` | 현재 발화 강제 종료 |
| `{ type: "terminate_session" }` | 세션 종료 |

### 8.5 Cartesia 클라이언트 (TTS)

**API 버전:** 2025-04-16  
**모델:** sonic-3

```ruby
# app/services/cartesia_client.rb
require 'websocket-client-simple'

class CartesiaClient
  URL = "wss://api.cartesia.ai/tts/websocket"
  MODEL = "sonic-3"
  VOICE_ID = "f6ff7c0c-e396-40a9-a70b-f7607edb6937"
  VERSION = "2025-04-16"

  def initialize
    @callbacks = []
    @context_counter = 0
    @mutex = Mutex.new
    connect
  end

  def send_text(text)
    return unless @ws&.open? && text.present?

    @context_counter += 1
    @ws.send({
      model_id: MODEL,
      transcript: text,
      voice: { mode: 'id', id: VOICE_ID },
      context_id: "ctx_#{(Time.now.to_f * 1000).to_i}_#{@context_counter}",
      output_format: { container: 'raw', encoding: 'pcm_s16le', sample_rate: 24000 },
      language: 'ko'
    }.to_json)
  end

  def on_event(&block)
    @mutex.synchronize { @callbacks << block }
  end

  def close
    @ws&.close
  end

  private

  def connect
    params = URI.encode_www_form(
      api_key: ENV['CARTESIA_API_KEY'],
      cartesia_version: VERSION
    )
    @ws = WebSocket::Client::Simple.connect("#{URL}?#{params}")

    @ws.on(:message) do |msg|
      handle(JSON.parse(msg.data))
    rescue JSON::ParserError => e
      Rails.logger.error("Cartesia parse error: #{e}")
    end

    @ws.on(:error) { |e| Rails.logger.error("Cartesia error: #{e}") }
  end

  def handle(data)
    return unless data['data']
    @mutex.synchronize do
      @callbacks.each { |cb| cb.call(type: 'tts_chunk', audio: data['data']) }
    end
  end
end
```

### 8.6 Middleware 등록

```ruby
# config/application.rb
require_relative '../lib/voice_websocket_middleware'

module YourApp
  class Application < Rails::Application
    config.middleware.use VoiceWebsocketMiddleware
  end
end
```

### 8.7 Puma 설정 (Rack hijack 활성화)

```ruby
# config/puma.rb
workers 0  # WebSocket은 단일 프로세스 권장
threads_count = ENV.fetch("RAILS_MAX_THREADS") { 5 }
threads threads_count, threads_count
```

### 8.8 환경 변수

```bash
ASSEMBLYAI_API_KEY=your_key
CARTESIA_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
```

---

## 9. 오디오 포맷 요약

| 구간 | 샘플레이트 | 비트 | 채널 | 인코딩 |
|------|-----------|------|------|--------|
| 클라이언트 → 서버 | 16kHz | 16-bit signed | mono | raw PCM (little-endian) |
| 서버 → 클라이언트 (TTS) | 24kHz | 16-bit signed | mono | Base64(raw PCM LE) |

---

## 10. 상태 다이어그램

```
┌──────────────┐
│ disconnected │
└──────┬───────┘
       │ WebSocket 연결
       ▼
┌──────────────┐  녹음 버튼   ┌───────────┐  완료 버튼   ┌────────────┐
│     idle     │ ──────────> │ recording │ ──────────> │ processing │
└──────────────┘             └───────────┘             └────────────┘
       ^                                                      │
       │                      llm_end 수신                     │
       └──────────────────────────────────────────────────────┘
```

---

## 11. 에러 처리

### 클라이언트

```typescript
ws.onerror = () => {
  // 재연결 또는 사용자 알림
  setState('disconnected');
};

// 서버 에러 이벤트 처리
if (event.type === 'error') {
  alert(event.message);
  setState('idle');
}
```

### 서버

```ruby
def process_llm(transcript)
  # ...
rescue => e
  send_event(type: 'error', message: "LLM 처리 실패: #{e.message}")
end
```

---

## 12. 테스트

### WebSocket 연결 테스트

```bash
# wscat 설치
npm install -g wscat

# 연결 테스트
wscat -c ws://localhost:3000/ws

# JSON 메시지 전송
> {"type":"end_of_speech"}
```

### 오디오 파일 전송 테스트 (Ruby)

```ruby
require 'websocket-client-simple'

ws = WebSocket::Client::Simple.connect('ws://localhost:3000/ws')

ws.on(:message) { |msg| puts msg.data }

# PCM 파일 전송
File.open('test.pcm', 'rb') do |f|
  while (chunk = f.read(3200))  # 100ms chunks
    ws.send(chunk, type: :binary)
    sleep 0.1
  end
end

ws.send({ type: 'end_of_speech' }.to_json)
```
