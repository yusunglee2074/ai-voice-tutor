require "websocket-client-simple"

class CartesiaClient
  CARTESIA_API_KEY = ENV.fetch("CARTESIA_API_KEY", "test_key")
  CARTESIA_WS_URL = "wss://api.cartesia.ai/tts/websocket"
  MODEL = "sonic-3"
  VOICE_ID = ENV.fetch("CARTESIA_VOICE_ID", "f6ff7c0c-e396-40a9-a70b-f7607edb6937")
  VERSION = "2025-04-16"

  def initialize
    @callbacks = []
    @context_counter = 0
    @mutex = Mutex.new
    @connected = false
    @connection_cv = ConditionVariable.new
    @connection_mutex = Mutex.new
    connect
  end

  def wait_for_connection(timeout: 5)
    @connection_mutex.synchronize do
      return true if @connected
      @connection_cv.wait(@connection_mutex, timeout)
      @connected
    end
  end

  def send_text(text)
    return unless @ws&.open?
    return if text.blank?

    @context_counter += 1
    message = {
      model_id: MODEL,
      transcript: text,
      voice: { mode: "id", id: VOICE_ID },
      context_id: "ctx_#{(Time.now.to_f * 1000).to_i}_#{@context_counter}",
      output_format: {
        container: "raw",
        encoding: "pcm_s16le",
        sample_rate: 24000
      },
      language: "ko"
    }.to_json

    @ws.send(message)
    Rails.logger.debug "[Cartesia] Sent text: #{text[0..50]}..."
  end

  def on_event(&block)
    @mutex.synchronize { @callbacks << block }
  end

  def close
    @ws&.close
    @ws = nil
  end

  private

  def connect
    params = URI.encode_www_form(
      api_key: CARTESIA_API_KEY,
      cartesia_version: VERSION
    )

    url = "#{CARTESIA_WS_URL}?#{params}"

    client = self

    @ws = WebSocket::Client::Simple.connect(url)

    @ws.on :open do
      Rails.logger.info "[Cartesia] Connected to TTS service"
      client.send(:mark_connected)
    end

    @ws.on :message do |msg|
      client.send(:handle, JSON.parse(msg.data))
    rescue JSON::ParserError => e
      Rails.logger.error "[Cartesia] Parse error: #{e.message}"
    end

    @ws.on :error do |e|
      Rails.logger.error "[Cartesia] Error: #{e.message}"
    end

    @ws.on :close do |e|
      Rails.logger.info "[Cartesia] Connection closed: #{e&.code} #{e&.reason}"
    end
  end

  def handle(data)
    return unless data["data"]

    @mutex.synchronize do
      @callbacks.each { |cb| cb.call(type: "tts_chunk", audio: data["data"]) }
    end
  end

  def mark_connected
    @connection_mutex.synchronize do
      @connected = true
      @connection_cv.broadcast
    end
  end
end
