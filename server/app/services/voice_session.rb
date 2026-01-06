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
      # Add current TTS generation to event
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
        when "end_of_speech"
          # Legacy support
          handle_auto_end_of_speech
        when "start_recording"
          # No-op for persistent STT connection
          Rails.logger.debug "[VoiceSession] start_recording event (no-op with persistent STT)"
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
