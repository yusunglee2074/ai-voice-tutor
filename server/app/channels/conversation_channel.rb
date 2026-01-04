class ConversationChannel < ApplicationCable::Channel
  def subscribed
    stream_from "conversation_#{params[:user_id]}"

    @user_id = params[:user_id]
    @stt_service = AssemblyAiService.new
    @llm_service = LlmService.new
    @tts_service = CartesiaService.new
    @conversation_context = []

    Rails.logger.info "[ConversationChannel] User #{@user_id} subscribed"

    # Send initial greeting
    send_initial_greeting
  end

  def unsubscribed
    Rails.logger.info "[ConversationChannel] User #{@user_id} unsubscribed"

    @stt_service&.close
    @tts_service&.close
    @conversation_context = []
  end

  def receive(data)
    if data['type'] == 'audio'
      handle_audio_data(data['audio'])
    elsif data['type'] == 'finalize_transcript'
      handle_finalize_transcript
    end
  end

  private

  def send_initial_greeting
    greeting = "Hello! I'm your AI English tutor. How can I help you practice English today?"

    # Send greeting text to client
    transmit({
      type: 'llm_chunk',
      text: greeting,
      ts: Time.now.to_f
    })

    # Generate TTS for greeting
    Thread.new do
      @tts_service.on_audio do |audio_base64|
        transmit({
          type: 'tts_chunk',
          audio: audio_base64,
          ts: Time.now.to_f
        })
      end

      @tts_service.connect
      @tts_service.send_text(greeting, is_final: true)
    end

    # Add to conversation history
    @llm_service.add_message('assistant', greeting)
  end

  def handle_audio_data(audio_base64)
    # Decode base64 audio
    audio_binary = Base64.decode64(audio_base64)

    # Setup STT callbacks if not already done
    unless @stt_callbacks_setup
      setup_stt_callbacks
      @stt_callbacks_setup = true
    end

    # Send to STT service
    @stt_service.send_audio(audio_binary)
  end

  def setup_stt_callbacks
    @stt_service.on_transcript do |text|
      transmit({
        type: 'stt_chunk',
        transcript: text,
        ts: Time.now.to_f
      })
    end

    @stt_service.on_final_transcript do |text|
      transmit({
        type: 'stt_output',
        transcript: text,
        ts: Time.now.to_f
      })

      @current_transcript = text
    end
  end

  def handle_finalize_transcript
    return unless @current_transcript && !@current_transcript.empty?

    user_message = @current_transcript
    @current_transcript = nil

    # Process through LLM and TTS pipeline
    Thread.new do
      process_llm_and_tts(user_message)
    end
  end

  def process_llm_and_tts(user_message)
    assistant_response = ""

    # Stream LLM response
    @llm_service.stream_response(user_message) do |text_chunk|
      assistant_response += text_chunk

      transmit({
        type: 'llm_chunk',
        text: text_chunk,
        ts: Time.now.to_f
      })

      # Send to TTS for streaming audio generation
      @tts_service.send_text(text_chunk, is_final: false)
    end

    # Finalize TTS
    @tts_service.send_text("", is_final: true)

    transmit({
      type: 'llm_end',
      ts: Time.now.to_f
    })

    # Add to conversation history
    @llm_service.add_message('assistant', assistant_response)
  rescue => e
    Rails.logger.error "[ConversationChannel] Error processing message: #{e.message}"
    transmit({
      type: 'error',
      message: 'Failed to process your message. Please try again.',
      ts: Time.now.to_f
    })
  end
end
