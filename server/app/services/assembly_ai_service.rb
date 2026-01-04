class AssemblyAiService
  ASSEMBLY_AI_API_KEY = ENV.fetch("ASSEMBLY_AI_API_KEY", "test_key")
  ASSEMBLY_AI_WS_URL = "wss://api.assemblyai.com/v2/realtime/ws"

  def initialize
    @connection = nil
    @on_transcript_callback = nil
    @on_final_transcript_callback = nil
  end

  # Connect to AssemblyAI WebSocket
  def connect
    require "faye/websocket"
    require "eventmachine"

    url = "#{ASSEMBLY_AI_WS_URL}?sample_rate=16000&token=#{ASSEMBLY_AI_API_KEY}"

    EM.run do
      @connection = Faye::WebSocket::Client.new(url)

      @connection.on :open do |event|
        Rails.logger.info "[AssemblyAI] Connected to STT service"
      end

      @connection.on :message do |event|
        handle_message(event.data)
      end

      @connection.on :close do |event|
        Rails.logger.info "[AssemblyAI] Connection closed: #{event.code} #{event.reason}"
        @connection = nil
      end

      @connection.on :error do |event|
        Rails.logger.error "[AssemblyAI] Error: #{event.message}"
      end
    end
  end

  # Send audio chunk to AssemblyAI
  def send_audio(audio_data)
    return unless @connection

    # Convert audio data to base64 if it's binary
    audio_base64 = if audio_data.is_a?(String) && audio_data.encoding == Encoding::BINARY
                     Base64.strict_encode64(audio_data)
    else
                     audio_data
    end

    message = { audio_data: audio_base64 }.to_json
    @connection.send(message)
  end

  # Register callback for partial transcripts
  def on_transcript(&block)
    @on_transcript_callback = block
  end

  # Register callback for final transcripts
  def on_final_transcript(&block)
    @on_final_transcript_callback = block
  end

  # Close connection
  def close
    @connection&.close
    @connection = nil
  end

  private

  def handle_message(data)
    message = JSON.parse(data)

    case message["message_type"]
    when "PartialTranscript"
      text = message["text"]
      @on_transcript_callback&.call(text) if text && !text.empty?
    when "FinalTranscript"
      text = message["text"]
      @on_final_transcript_callback&.call(text) if text && !text.empty?
    when "SessionBegins"
      Rails.logger.info "[AssemblyAI] Session started: #{message['session_id']}"
    when "SessionTerminated"
      Rails.logger.info "[AssemblyAI] Session terminated"
    end
  rescue JSON::ParserError => e
    Rails.logger.error "[AssemblyAI] Failed to parse message: #{e.message}"
  end
end
