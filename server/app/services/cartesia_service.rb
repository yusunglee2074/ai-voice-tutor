class CartesiaService
  CARTESIA_API_KEY = ENV.fetch("CARTESIA_API_KEY", "test_key")
  CARTESIA_WS_URL = "wss://api.cartesia.ai/tts/websocket"
  VOICE_ID = ENV.fetch("CARTESIA_VOICE_ID", "6ccbfb76-1fc6-48f7-b71d-91ac6298247b")

  def initialize
    @connection = nil
    @on_audio_callback = nil
    @context_id = SecureRandom.uuid
  end

  # Connect to Cartesia WebSocket
  def connect
    require "faye/websocket"
    require "eventmachine"

    url = "#{CARTESIA_WS_URL}?api_key=#{CARTESIA_API_KEY }&cartesia_version=2025-04-16"

    EM.run do
      @connection = Faye::WebSocket::Client.new(url)

      @connection.on :open do |event|
        Rails.logger.info "[Cartesia] Connected to TTS service"
      end

      @connection.on :message do |event|
        handle_message(event.data)
      end

      @connection.on :close do |event|
        Rails.logger.info "[Cartesia] Connection closed: #{event.code} #{event.reason}"
        @connection = nil
      end

      @connection.on :error do |event|
        Rails.logger.error "[Cartesia] Error: #{event.message}"
      end
    end
  end

  # Send text chunk for TTS
  def send_text(text, is_final: false)
    return unless @connection

    message = {
      model_id: "sonic-3-latest",
      voice: {
        mode: "id",
        id: VOICE_ID
      },
      transcript: text,
      continue: !is_final,
      context_id: @context_id,
      output_format: {
        container: "raw",
        encoding: "pcm_s16le",
        sample_rate: 24000
      }
    }.to_json

    @connection.send(message)
  end

  # Register callback for audio chunks
  def on_audio(&block)
    @on_audio_callback = block
  end

  # Close connection
  def close
    @connection&.close
    @connection = nil
  end

  private

  def handle_message(data)
    message = JSON.parse(data)

    case message["type"]
    when "chunk"
      # Audio data is base64 encoded PCM
      audio_base64 = message["data"]
      @on_audio_callback&.call(audio_base64) if audio_base64
    when "done"
      Rails.logger.debug "[Cartesia] TTS generation complete"
    when "error"
      Rails.logger.error "[Cartesia] Error: #{message['error']}"
    end
  rescue JSON::ParserError => e
    Rails.logger.error "[Cartesia] Failed to parse message: #{e.message}"
  end
end
