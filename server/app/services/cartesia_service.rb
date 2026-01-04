class CartesiaService
  CARTESIA_API_KEY = ENV.fetch('CARTESIA_API_KEY', 'test_key')
  CARTESIA_WS_URL = 'wss://api.cartesia.ai/tts/websocket'
  VOICE_ID = ENV.fetch('CARTESIA_VOICE_ID', 'a0e99841-438c-4a64-b679-ae501e7d6091') # Barbershop Man

  def initialize
    @connection = nil
    @on_audio_callback = nil
    @context_id = SecureRandom.uuid
  end

  # Connect to Cartesia WebSocket
  def connect
    require 'faye/websocket'
    require 'eventmachine'

    url = "#{CARTESIA_WS_URL}?api_key=#{CARTESIA_API_KEY}&cartesia_version=2024-06-10"

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
      model_id: 'sonic-english',
      voice: {
        mode: 'id',
        id: VOICE_ID
      },
      transcript: text,
      continue: !is_final,
      context_id: @context_id,
      output_format: {
        container: 'raw',
        encoding: 'pcm_s16le',
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

    case message['type']
    when 'chunk'
      # Audio data is base64 encoded PCM
      audio_base64 = message['data']
      @on_audio_callback&.call(audio_base64) if audio_base64
    when 'done'
      Rails.logger.debug "[Cartesia] TTS generation complete"
    when 'error'
      Rails.logger.error "[Cartesia] Error: #{message['error']}"
    end
  rescue JSON::ParserError => e
    Rails.logger.error "[Cartesia] Failed to parse message: #{e.message}"
  end
end
