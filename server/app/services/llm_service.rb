class LlmService
  GEMINI_API_KEY = ENV.fetch("GEMINI_API_KEY", "test_key")
  GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:streamGenerateContent"
  MODEL = "gemini-2.5-flash-lite"

  def initialize
    @conversation_history = []
  end

  # Add message to conversation history
  def add_message(role, content)
    # Gemini uses 'user' and 'model' roles
    gemini_role = role == "assistant" ? "model" : "user"
    @conversation_history << { role: gemini_role, parts: [ { text: content } ] }
  end

  # Stream LLM response
  def stream_response(user_message, &block)
    add_message("user", user_message)

    url = "#{GEMINI_API_URL}?key=#{GEMINI_API_KEY}&alt=sse"

    connection = Faraday.new(url: url) do |f|
      f.request :json
      f.adapter Faraday.default_adapter
    end

    response = connection.post do |req|
      req.headers["Content-Type"] = "application/json"

      req.body = {
        contents: @conversation_history,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
          topP: 0.95,
          topK: 40
        },
        systemInstruction: {
          parts: [ { text: "You are a helpful English tutor. Be concise and encouraging." } ]
        }
      }.to_json

      req.options.on_data = proc do |chunk, _size|
        process_stream_chunk(chunk, &block)
      end
    end

    response
  rescue Faraday::Error => e
    Rails.logger.error "[LLM] Gemini API Error: #{e.message}"
    raise
  end

  # Get non-streaming response
  def get_response(user_message)
    add_message("user", user_message)

    url = "https://generativelanguage.googleapis.com/v1beta/models/#{MODEL}:generateContent?key=#{GEMINI_API_KEY}"

    connection = Faraday.new(url: url) do |f|
      f.request :json
      f.response :json
      f.adapter Faraday.default_adapter
    end

    response = connection.post do |req|
      req.headers["Content-Type"] = "application/json"

      req.body = {
        contents: @conversation_history,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
          topP: 0.95,
          topK: 40
        },
        systemInstruction: {
          parts: [ { text: "You are a helpful English tutor. Be concise and encouraging." } ]
        }
      }
    end

    if response.success?
      assistant_message = response.body.dig("candidates", 0, "content", "parts", 0, "text")
      add_message("assistant", assistant_message) if assistant_message
      assistant_message
    else
      Rails.logger.error "[LLM] Gemini API Error: #{response.status} #{response.body}"
      nil
    end
  rescue Faraday::Error => e
    Rails.logger.error "[LLM] Gemini API Error: #{e.message}"
    nil
  end

  # Clear conversation history
  def clear_history
    @conversation_history = []
  end

  # Get conversation history
  def history
    @conversation_history
  end

  private

  def process_stream_chunk(chunk, &block)
    # Parse SSE format from Gemini
    lines = chunk.split("\n")

    lines.each do |line|
      next unless line.start_with?("data: ")

      data = line.sub("data: ", "").strip
      next if data.empty?

      begin
        event = JSON.parse(data)

        # Gemini streaming format
        text = event.dig("candidates", 0, "content", "parts", 0, "text")
        block.call(text) if text && !text.empty?

        # Check if stream is finished
        finish_reason = event.dig("candidates", 0, "finishReason")
        if finish_reason
          Rails.logger.debug "[LLM] Gemini stream completed: #{finish_reason}"
        end
      rescue JSON::ParserError => e
        Rails.logger.debug "[LLM] Skipping invalid JSON: #{e.message}"
      end
    end
  end
end
