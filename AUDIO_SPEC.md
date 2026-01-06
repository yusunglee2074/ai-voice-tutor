# Voice WebSocket 프로토콜 기술 문서

## 개요

실시간 음성 대화 시스템의 WebSocket 프로토콜 명세입니다.
음성 입력 → STT → LLM → TTS 파이프라인을 구현합니다.

**동작 방식:** Full-duplex 실시간 대화
- STT 연결이 지속적으로 유지되어 사용자 음성을 실시간으로 전사
- AssemblyAI의 `format_turns` 기능으로 발화 종료를 자동 감지
- 발화 종료 감지 시 자동으로 LLM 응답 생성
- AI 응답 중 사용자가 말하면 자동으로 중단(interrupt)

---

## 1. 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                         클라이언트 (Web)                          │
├─────────────────────────────────────────────────────────────────┤
│  마이크 항상 활성 → PCM 16kHz → WebSocket 전송                    │
│  STT 실시간 피드백 표시                                           │
│  발화 종료 자동 감지 → LLM 응답 자동 생성                          │
│  AI 응답 중 사용자 발화 시 자동 중단                               │
│  <────────────────── WebSocket → JSON 이벤트 → 오디오 재생       │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ ws:// 또는 wss://
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                            서버 (Rails)                          │
├─────────────────────────────────────────────────────────────────┤
│  지속적 STT 연결 → 발화 종료 감지 → LLM → TTS                     │
│  Interrupt 처리로 TTS 중단 지원                                   │
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
| JSON | `{ type: "auto_end_of_speech" }` | 발화 종료 감지 후 LLM 처리 요청 |
| JSON | `{ type: "interrupt" }` | AI 응답 중단 요청 |

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

#### `auto_end_of_speech` - 발화 종료 후 LLM 처리

AssemblyAI가 발화 종료를 감지하여 `stt_output` 이벤트를 보낸 후, 클라이언트가 자동으로 전송합니다.

```json
{ "type": "auto_end_of_speech" }
```

#### `interrupt` - AI 응답 중단

사용자가 AI 응답 중에 말을 시작할 때 전송하여 TTS를 중단합니다.

```json
{ "type": "interrupt" }
```

### 4.2 서버 → 클라이언트 이벤트

#### `stt_chunk` - 부분 전사 (실시간)

```json
{ "type": "stt_chunk", "ts": 1704355200000, "transcript": "안녕하세" }
```

#### `stt_output` - 최종 전사 (발화 종료 감지)

AssemblyAI의 `format_turns` 기능이 발화 종료를 감지하면 전송됩니다.

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
{
  "type": "tts_chunk",
  "ts": 1704355204000,
  "audio": "base64...",
  "tts_generation": 1
}
```

**TTS 오디오 포맷:** 24kHz, 16-bit signed little-endian, mono, Base64 인코딩
**tts_generation:** TTS 생성 번호. interrupt 시 증가하여 이전 청크 무시

#### `tts_end` - TTS 재생 완료

```json
{ "type": "tts_end", "ts": 1704355205000 }
```

#### `interrupted` - 중단 확인

```json
{
  "type": "interrupted",
  "ts": 1704355206000,
  "tts_generation": 2
}
```

#### `error` - 에러

```json
{ "type": "error", "ts": 1704355207000, "message": "STT connection failed" }
```

---

## 5. 이벤트 흐름 (실시간 대화)

```
클라이언트                         서버
    │                               │
    │  [WebSocket 연결]              │
    │<── llm_chunk ─────────────────│  (초기 인사말)
    │<── llm_end ───────────────────│
    │<── tts_chunk ─────────────────│
    │                               │
    │  [마이크 항상 활성]             │
    │── Binary (PCM) ──────────────>│  (지속적 전송)
    │<── stt_chunk ─────────────────│  (실시간 피드백)
    │── Binary (PCM) ──────────────>│
    │<── stt_chunk ─────────────────│
    │                               │
    │  [발화 종료 자동 감지]           │
    │<── stt_output ────────────────│  (format_turns 감지)
    │── { type: "auto_end_of_speech" } ─>│
    │                               │  LLM 처리
    │<── llm_chunk ─────────────────│
    │<── llm_chunk ─────────────────│
    │<── llm_end ───────────────────│
    │                               │  TTS 처리
    │<── tts_chunk ─────────────────│  (generation: 1)
    │<── tts_chunk ─────────────────│
    │                               │
    │  [AI 응답 중 사용자 발화]        │
    │── { type: "interrupt" } ─────>│
    │<── interrupted ───────────────│  (generation: 2)
    │<── stt_chunk ─────────────────│  (새 발화 전사)
    │   ...                         │
```

---

## 6. 타입 정의

### TypeScript (클라이언트)

```typescript
// 클라이언트 → 서버
type ClientEvent =
  | { type: "auto_end_of_speech" }
  | { type: "interrupt" };

// 서버 → 클라이언트
type ServerEvent =
  | { type: "stt_chunk"; ts: number; transcript: string }
  | { type: "stt_output"; ts: number; transcript: string }
  | { type: "llm_chunk"; ts: number; text: string }
  | { type: "llm_end"; ts: number }
  | { type: "tts_chunk"; ts: number; audio: string; tts_generation?: number }
  | { type: "tts_end"; ts: number }
  | { type: "interrupted"; ts: number; tts_generation: number }
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

마이크를 항상 활성화하여 지속적으로 오디오를 전송합니다.

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

TTS 생성 번호를 추적하여 interrupt 시 이전 청크를 무시합니다.

```typescript
const TTS_SAMPLE_RATE = 24000;

export function createAudioPlayback() {
  let audioContext: AudioContext | null = null;
  let nextPlayTime = 0;
  let currentGeneration = 0;

  return {
    play(base64: string, generation: number = 0) {
      // 이전 세대의 오디오는 무시
      if (generation < currentGeneration) {
        console.log('Ignoring old TTS chunk');
        return;
      }

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

    stop() {
      nextPlayTime = 0;
    },

    updateGeneration(generation: number) {
      currentGeneration = generation;
      nextPlayTime = 0; // 재생 큐 초기화
    }
  };
}
```

### 7.3 실시간 대화 세션 관리

```typescript
type SessionState = 'disconnected' | 'listening' | 'processing' | 'speaking';

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

      ws.onopen = async () => {
        setState('listening');
        // 마이크 자동 시작
        try {
          await capture.start((chunk) => {
            if (ws?.readyState === WebSocket.OPEN) ws.send(chunk);
          });
        } catch (err) {
          console.error('Microphone access denied:', err);
        }
      };

      ws.onmessage = (e) => {
        const event: ServerEvent = JSON.parse(e.data);
        onEvent(event);

        switch (event.type) {
          case 'stt_output':
            // 발화 종료 감지 - 자동으로 LLM 처리 요청
            ws?.send(JSON.stringify({ type: 'auto_end_of_speech' }));
            setState('processing');
            break;

          case 'tts_chunk':
            // TTS 재생 시작
            if (state !== 'speaking') setState('speaking');
            playback.play(event.audio, event.tts_generation);
            break;

          case 'tts_end':
            setState('listening');
            break;

          case 'interrupted':
            // 중단 확인 - 생성 번호 업데이트
            playback.updateGeneration(event.tts_generation);
            setState('listening');
            break;

          case 'error':
            setState('listening');
            break;
        }
      };

      ws.onerror = () => setState('disconnected');
      ws.onclose = () => {
        capture.stop();
        setState('disconnected');
      };
    },

    interrupt() {
      // AI 응답 중단
      if (state === 'speaking' && ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'interrupt' }));
      }
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
          case 'stt_chunk':
            setTranscript(event.transcript);
            break;
          case 'stt_output':
            setTranscript(event.transcript);
            setResponse('');
            break;
          case 'llm_chunk':
            setResponse(prev => prev + event.text);
            break;
          case 'error':
            alert(event.message);
            break;
        }
      },
      setState
    );
    return () => session.disconnect();
  }, []);

  const handleInterrupt = () => {
    sessionRef.current.interrupt();
  };

  return (
    <div>
      <div>
        상태: {state === 'listening' && '🎤 듣는 중'}
        {state === 'processing' && '⏳ 생각하는 중'}
        {state === 'speaking' && '🔊 말하는 중'}
        {state === 'disconnected' && '❌ 연결 끊김'}
      </div>
      {state === 'speaking' && (
        <button onClick={handleInterrupt}>중단</button>
      )}
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
gem 'google-gemini-ai'        # Gemini LLM
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

### 8.3 VoiceSession 클래스 (실시간 대화)

```ruby
# app/services/voice_session.rb
class VoiceSession
  def initialize(ws)
    @ws = ws
    @stt = nil
    @tts = nil
    @llm = nil
    @messages = []
    @current_transcript = ""
    @mutex = Mutex.new
    @processing = false
    @tts_generation = 0
  end

  def start
    @tts = CartesiaClient.new
    @llm = LlmService.new

    # Setup TTS event listeners with generation tracking
    @tts.on_event do |event|
      event_with_gen = event.merge(tts_generation: @tts_generation)
      send_event(event_with_gen)
    end

    # Connect STT persistently for full-duplex conversation
    connect_stt

    # Send initial greeting
    send_initial_greeting
  end

  def handle_message(data)
    if data.is_a?(Array) || data.encoding == Encoding::BINARY
      # Binary audio data - send to STT
      @stt&.send_audio(data)
    else
      # JSON message
      begin
        msg = JSON.parse(data)
        case msg["type"]
        when "auto_end_of_speech"
          handle_auto_end_of_speech
        when "interrupt"
          handle_interrupt
        end
      rescue JSON::ParserError
        # Treat as binary if JSON parsing fails
        @stt&.send_audio(data)
      end
    end
  end

  def stop
    disconnect_stt
    @tts&.close
    @tts = nil
    @llm = nil
  end

  private

  def connect_stt
    return if @stt

    Rails.logger.info "[VoiceSession] Connecting to STT (persistent)"
    @stt = AssemblyAiClient.new(sample_rate: 16000)

    # Setup STT event listeners
    @stt.on_event do |event|
      send_event(event)
      if event[:type] == "stt_output"
        @current_transcript = event[:transcript]
      end
    end
  end

  def disconnect_stt
    return unless @stt

    Rails.logger.info "[VoiceSession] Disconnecting STT"
    @stt.close
    @stt = nil
    @current_transcript = ""
  end

  def handle_auto_end_of_speech
    # Prevent concurrent processing
    return if @processing

    @mutex.synchronize do
      return if @processing
      @processing = true
    end

    # Force STT to finalize current turn
    @stt&.force_endpoint

    # Wait briefly for final transcript, then process
    Thread.new do
      begin
        sleep 0.5

        transcript = @current_transcript
        @current_transcript = ""

        if transcript.present?
          process_llm(transcript)
        else
          Rails.logger.warn "[VoiceSession] Empty transcript, skipping LLM processing"
        end
      ensure
        @mutex.synchronize { @processing = false }
      end
    end
  end

  def handle_interrupt
    Rails.logger.info "[VoiceSession] Interrupt received, canceling TTS"

    # Increment TTS generation to invalidate old chunks
    @mutex.synchronize do
      @tts_generation += 1
      @processing = false
    end

    # Cancel current TTS generation
    @tts&.cancel_current

    # Send interrupted acknowledgment with new generation
    send_event(type: "interrupted", tts_generation: @tts_generation)
  end

  def send_initial_greeting
    greeting = "Hello! I'm your AI English tutor. How can I help you practice English today?"

    # Send greeting text to client
    send_event(type: "llm_chunk", text: greeting)
    send_event(type: "llm_end")

    # Generate TTS for greeting (wait for connection first)
    Thread.new do
      if @tts.wait_for_connection(timeout: 5)
        @tts.send_text(greeting)
        Rails.logger.info "[VoiceSession] Sent initial greeting to TTS"
      else
        Rails.logger.error "[VoiceSession] TTS connection timeout, greeting audio not sent"
      end
    end

    # Add to conversation history
    @llm.add_message("assistant", greeting)
  end

  def process_llm(transcript)
    return if transcript.blank?

    assistant_response = ""

    # Stream LLM response (text only, no TTS yet)
    @llm.stream_response(transcript) do |text_chunk|
      assistant_response += text_chunk
      send_event(type: "llm_chunk", text: text_chunk)
    end

    # Add to conversation history
    @llm.add_message("assistant", assistant_response)

    # Send llm_end event
    send_event(type: "llm_end")

    # Generate TTS for complete response
    if assistant_response.present?
      # Increment TTS generation for new response (enables client-side buffering)
      @mutex.synchronize { @tts_generation += 1 }
      Rails.logger.info "[VoiceSession] Starting TTS generation #{@tts_generation}"

      @tts.send_text(assistant_response)
      Rails.logger.info "[VoiceSession] Sent complete response to TTS: #{assistant_response[0..50]}..."
    end
  rescue => e
    Rails.logger.error "[VoiceSession] Error processing LLM: #{e.message}"
    Rails.logger.error e.backtrace.join("\n")
    send_event(type: "error", message: "Failed to process your message. Please try again.")
  end

  def send_event(event)
    return unless @ws

    event_with_ts = { ts: (Time.now.to_f * 1000).to_i }.merge(event)
    @ws.send(event_with_ts.to_json)
  rescue => e
    Rails.logger.error "[VoiceSession] Error sending event: #{e.message}"
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

### 8.5 Cartesia 클라이언트 (TTS with Interrupt Support)

**API 버전:** 2025-04-16
**모델:** sonic-3

```ruby
# app/services/cartesia_client.rb
require 'websocket-client-simple'

class CartesiaClient
  URL = "wss://api.cartesia.ai/tts/websocket"
  MODEL = "sonic-3"
  VOICE_ID = ENV.fetch('CARTESIA_VOICE_ID', 'f6ff7c0c-e396-40a9-a70b-f7607edb6937')
  VERSION = "2025-04-16"

  def initialize
    @callbacks = []
    @context_counter = 0
    @current_context_id = nil
    @mutex = Mutex.new
    @connected = false
    @connection_cv = ConditionVariable.new
    connect
  end

  def send_text(text)
    return unless @ws&.open? && text.present?

    @mutex.synchronize do
      @context_counter += 1
      @current_context_id = "ctx_#{(Time.now.to_f * 1000).to_i}_#{@context_counter}"
    end

    @ws.send({
      model_id: MODEL,
      transcript: text,
      voice: { mode: 'id', id: VOICE_ID },
      context_id: @current_context_id,
      output_format: { container: 'raw', encoding: 'pcm_s16le', sample_rate: 24000 },
      language: 'en'
    }.to_json)

    Rails.logger.info "[Cartesia] Sent text for TTS: #{text[0..50]}..."
  end

  def cancel_current
    return unless @ws&.open? || !@current_context_id

    # Send cancel message for current context
    @ws.send({
      context_id: @current_context_id,
      cancel: true
    }.to_json)

    Rails.logger.info "[Cartesia] Cancelled context: #{@current_context_id}"
    @current_context_id = nil
  end

  def wait_for_connection(timeout: 5)
    @mutex.synchronize do
      return true if @connected
      @connection_cv.wait(@mutex, timeout)
      @connected
    end
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

    @ws.on(:open) do
      Rails.logger.info "[Cartesia] Connected to TTS WebSocket"
      @mutex.synchronize do
        @connected = true
        @connection_cv.broadcast
      end
    end

    @ws.on(:message) do |msg|
      handle(JSON.parse(msg.data))
    rescue JSON::ParserError => e
      Rails.logger.error("[Cartesia] Parse error: #{e}")
    end

    @ws.on(:error) { |e| Rails.logger.error("[Cartesia] Error: #{e}") }
    @ws.on(:close) do
      Rails.logger.info "[Cartesia] Connection closed"
      @mutex.synchronize { @connected = false }
    end
  end

  def handle(data)
    if data['done']
      # TTS generation complete
      @mutex.synchronize do
        @callbacks.each { |cb| cb.call(type: 'tts_end') }
      end
    elsif data['data']
      # TTS audio chunk
      @mutex.synchronize do
        @callbacks.each { |cb| cb.call(type: 'tts_chunk', audio: data['data']) }
      end
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
CARTESIA_VOICE_ID=f6ff7c0c-e396-40a9-a70b-f7607edb6937  # Optional
GEMINI_API_KEY=your_key
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
       │ WebSocket 연결 + 마이크 자동 시작
       ▼
┌──────────────┐  발화 종료 감지   ┌────────────┐  LLM 응답 완료   ┌───────────┐
│  listening   │ ───────────────> │ processing │ ──────────────> │ speaking  │
└──────────────┘                  └────────────┘                 └───────────┘
       ^                                                                │
       │                                                                │
       │                          TTS 재생 완료 또는 interrupt          │
       └────────────────────────────────────────────────────────────────┘
```

**상태 설명:**
- `disconnected`: WebSocket 연결 전 또는 연결 끊김
- `listening`: 마이크 활성화, 사용자 음성 대기 중
- `processing`: 발화 종료 감지 후 LLM 응답 생성 중
- `speaking`: AI 응답 TTS 재생 중 (interrupt 가능)

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
  setState('listening');
}
```

### 서버

```ruby
def process_llm(transcript)
  # ...
rescue => e
  Rails.logger.error "[VoiceSession] Error processing LLM: #{e.message}"
  send_event(type: 'error', message: "Failed to process your message. Please try again.")
end
```

---

## 12. 실시간 대화 구현 핵심 포인트

### 12.1 지속적 STT 연결

- WebSocket 연결 시 STT를 즉시 연결하고 세션 종료까지 유지
- 마이크를 항상 활성화하여 지속적으로 오디오 전송
- AssemblyAI의 `format_turns` 파라미터로 발화 종료 자동 감지

### 12.2 자동 발화 종료 감지

- AssemblyAI가 `stt_output` 이벤트로 발화 종료 알림
- 클라이언트가 자동으로 `auto_end_of_speech` 메시지 전송
- 서버가 LLM 처리 시작

### 12.3 Interrupt 처리

- AI 응답 중 사용자가 말하면 클라이언트가 `interrupt` 메시지 전송
- 서버가 TTS 생성 번호를 증가시켜 이전 청크 무효화
- 클라이언트가 생성 번호를 확인하여 이전 오디오 무시

### 12.4 TTS 생성 번호 관리

```ruby
# 서버: 새 응답마다 생성 번호 증가
@tts_generation += 1
send_event(type: 'tts_chunk', audio: data, tts_generation: @tts_generation)

# 클라이언트: 이전 생성 번호의 청크 무시
if (chunkGeneration < currentTtsGenerationRef.current) {
  console.log('Ignoring old TTS chunk');
  return;
}
```

---

## 13. 테스트

### WebSocket 연결 테스트

```bash
# wscat 설치
npm install -g wscat

# 연결 테스트
wscat -c ws://localhost:3000/ws

# JSON 메시지 전송
> {"type":"auto_end_of_speech"}
> {"type":"interrupt"}
```

### 오디오 파일 전송 테스트 (Ruby)

```ruby
require 'websocket-client-simple'

ws = WebSocket::Client::Simple.connect('ws://localhost:3000/ws')

ws.on(:message) { |msg| puts msg.data }

# PCM 파일 전송 (지속적으로)
File.open('test.pcm', 'rb') do |f|
  while (chunk = f.read(3200))  # 100ms chunks
    ws.send(chunk, type: :binary)
    sleep 0.1
  end
end

# 발화 종료 시뮬레이션
sleep 1
ws.send({ type: 'auto_end_of_speech' }.to_json)
```

---

## 14. 성능 최적화

### 14.1 레이턴시 최소화

- **STT**: AssemblyAI v3의 실시간 스트리밍 사용
- **LLM**: Gemini 2.5 Flash Lite의 스트리밍 API 사용
- **TTS**: Cartesia sonic-3의 WebSocket 스트리밍 사용
- **네트워크**: Raw WebSocket으로 오버헤드 최소화

### 14.2 오디오 버퍼링

```typescript
// 클라이언트: Web Audio API의 스케줄링으로 끊김 없는 재생
if (nextPlayTime < audioContext.currentTime) {
  nextPlayTime = audioContext.currentTime;
}
source.start(nextPlayTime);
nextPlayTime += audioBuffer.duration;
```

### 14.3 동시성 제어

```ruby
# 서버: Mutex로 동시 처리 방지
@mutex.synchronize do
  return if @processing
  @processing = true
end
```

---

## 15. 보안 고려사항

### 15.1 WebSocket 인증

```ruby
# Middleware에서 토큰 검증
def call(env)
  if Faye::WebSocket.websocket?(env) && env['PATH_INFO'] == '/ws'
    # 토큰 검증 로직
    token = env['HTTP_AUTHORIZATION']&.sub(/^Bearer /, '')
    unless valid_token?(token)
      return [401, {}, ['Unauthorized']]
    end

    # WebSocket 연결 처리
    # ...
  end
end
```

### 15.2 Rate Limiting

```ruby
# Redis를 사용한 rate limiting
def handle_message(data)
  user_id = @user_id
  key = "ws_rate_limit:#{user_id}"

  count = Redis.current.incr(key)
  Redis.current.expire(key, 60) if count == 1

  if count > 1000  # 분당 1000 메시지 제한
    send_event(type: 'error', message: 'Rate limit exceeded')
    return
  end

  # 메시지 처리
  # ...
end
```

---

## 16. 트러블슈팅

### 16.1 STT 연결 끊김

**증상**: `stt_chunk` 이벤트가 더 이상 수신되지 않음

**해결**:
```ruby
# 연결 상태 모니터링 및 재연결
def ensure_stt_connected
  return if @stt&.connected?

  Rails.logger.warn "[VoiceSession] STT disconnected, reconnecting..."
  disconnect_stt
  connect_stt
end
```

### 16.2 TTS 오디오 끊김

**증상**: 오디오 재생이 끊기거나 지연됨

**해결**:
```typescript
// 버퍼 크기 조정 및 스케줄링 개선
const BUFFER_THRESHOLD = 0.1; // 100ms 버퍼
if (nextPlayTime - audioContext.currentTime < BUFFER_THRESHOLD) {
  nextPlayTime = audioContext.currentTime + BUFFER_THRESHOLD;
}
```

### 16.3 Interrupt 미작동

**증상**: interrupt 메시지를 보내도 TTS가 계속 재생됨

**해결**:
```typescript
// 생성 번호 확인 로직 강화
const chunkGeneration = data.tts_generation ?? 0;
if (chunkGeneration < currentTtsGenerationRef.current) {
  console.log('[WebSocket] Ignoring old TTS chunk');
  return; // 이전 청크 무시
}
```

---

## 17. 참고 자료

- [AssemblyAI v3 API Documentation](https://www.assemblyai.com/docs)
- [Cartesia TTS API Documentation](https://docs.cartesia.ai/)
- [Google Gemini API Documentation](https://ai.google.dev/docs)
- [Faye WebSocket Documentation](https://github.com/faye/faye-websocket-ruby)
- [Web Audio API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
