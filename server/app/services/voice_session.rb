class VoiceSession
  def initialize(ws)
    @ws = ws
    @stt = nil
    @tts = nil
    @llm = nil
    @messages = []
    @current_transcript = ""
  end

  def start
    @tts = CartesiaClient.new
    @llm = LlmService.new

    # Setup TTS event listeners
    @tts.on_event { |event| send_event(event) }

    # Send initial greeting
    send_initial_greeting
  end

  def handle_message(data)
    if data.is_a?(Array) || data.encoding == Encoding::BINARY
      ensure_stt_connected
      @stt&.send_audio(data)
    else
      # JSON message
      begin
        msg = JSON.parse(data)
        if msg["type"] == "end_of_speech"
          handle_end_of_speech
        elsif msg["type"] == "start_recording"
          handle_start_recording
        end
      rescue JSON::ParserError
        # Treat as binary if JSON parsing fails
        ensure_stt_connected
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

  def ensure_stt_connected
    return if @stt

    Rails.logger.info "[VoiceSession] Connecting to STT"
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

  def handle_start_recording
    # Reconnect STT when user starts recording
    ensure_stt_connected
    Rails.logger.info "[VoiceSession] Ready for recording"
  end

  def handle_end_of_speech
    # Force STT to finalize current turn
    @stt&.force_endpoint

    # Wait briefly for final transcript, then process and disconnect
    Thread.new do
      sleep 0.5
      process_llm(@current_transcript) if @current_transcript.present?

      # Disconnect STT after processing
      disconnect_stt
    end
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
