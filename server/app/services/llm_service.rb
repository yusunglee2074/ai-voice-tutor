class LlmService
  ANTHROPIC_API_KEY = ENV.fetch('ANTHROPIC_API_KEY', 'test_key')
  ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
  MODEL = 'claude-3-5-sonnet-20241022'

  def initialize
    @conversation_history = []
  end

  # Add message to conversation history
  def add_message(role, content)
    @conversation_history << { role: role, content: content }
  end

  # Stream LLM response
  def stream_response(user_message, &block)
    add_message('user', user_message)

    connection = Faraday.new(url: ANTHROPIC_API_URL) do |f|
      f.request :json
      f.adapter Faraday.default_adapter
    end

    response = connection.post do |req|
      req.headers['Content-Type'] = 'application/json'
      req.headers['x-api-key'] = ANTHROPIC_API_KEY
      req.headers['anthropic-version'] = '2023-06-01'

      req.body = {
        model: MODEL,
        max_tokens: 1024,
        messages: @conversation_history,
        stream: true
      }.to_json

      req.options.on_data = proc do |chunk, _size|
        process_stream_chunk(chunk, &block)
      end
    end

    response
  rescue Faraday::Error => e
    Rails.logger.error "[LLM] API Error: #{e.message}"
    raise
  end

  # Get non-streaming response
  def get_response(user_message)
    add_message('user', user_message)

    connection = Faraday.new(url: ANTHROPIC_API_URL) do |f|
      f.request :json
      f.response :json
      f.adapter Faraday.default_adapter
    end

    response = connection.post do |req|
      req.headers['Content-Type'] = 'application/json'
      req.headers['x-api-key'] = ANTHROPIC_API_KEY
      req.headers['anthropic-version'] = '2023-06-01'

      req.body = {
        model: MODEL,
        max_tokens: 1024,
        messages: @conversation_history,
        stream: false
      }
    end

    if response.success?
      assistant_message = response.body.dig('content', 0, 'text')
      add_message('assistant', assistant_message) if assistant_message
      assistant_message
    else
      Rails.logger.error "[LLM] API Error: #{response.status} #{response.body}"
      nil
    end
  rescue Faraday::Error => e
    Rails.logger.error "[LLM] API Error: #{e.message}"
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
    # Parse SSE format
    lines = chunk.split("\n")

    lines.each do |line|
      next unless line.start_with?('data: ')

      data = line.sub('data: ', '').strip
      next if data == '[DONE]'

      begin
        event = JSON.parse(data)

        case event['type']
        when 'content_block_delta'
          text = event.dig('delta', 'text')
          block.call(text) if text && !text.empty?
        when 'message_stop'
          # Stream ended
          Rails.logger.debug "[LLM] Stream completed"
        end
      rescue JSON::ParserError
        # Skip invalid JSON
      end
    end
  end
end
