require "websocket-client-simple"

class AssemblyAiClient
  ASSEMBLY_AI_API_KEY = ENV.fetch("ASSEMBLYAI_API_KEY", "test_key")
  ASSEMBLY_AI_WS_URL = "wss://streaming.assemblyai.com/v3/ws"

  def initialize(sample_rate: 16000)
    @callbacks = []
    @mutex = Mutex.new
    @sample_rate = sample_rate
    connect
  end

  def send_audio(bytes)
    return unless @ws&.open?
    @ws.send(bytes, type: :binary)
  rescue Errno::EPIPE, IOError => e
    Rails.logger.warn "[AssemblyAI] Send failed (connection closed): #{e.message}"
    @ws = nil
  end

  # AssemblyAI v3: Force endpoint to finalize current turn
  def force_endpoint
    return unless @ws&.open?
    @ws.send({ type: "ForceEndpoint" }.to_json)
    Rails.logger.debug "[AssemblyAI] Sent ForceEndpoint"
  end

  def on_event(&block)
    @mutex.synchronize { @callbacks << block }
  end

  def close
    return unless @ws
    if @ws.open?
      @ws.send({ type: "Terminate" }.to_json) rescue nil
    end
    @ws.close rescue nil
    @ws = nil
  end

  private

  def connect
    params = URI.encode_www_form(
      sample_rate: @sample_rate,
      format_turns: true,
      inactivity_timeout: 300
    )

    url = "#{ASSEMBLY_AI_WS_URL}?#{params}"

    client = self

    @ws = WebSocket::Client::Simple.connect(
      url,
      headers: { "Authorization" => ASSEMBLY_AI_API_KEY }
    )

    @ws.on :open do
      Rails.logger.info "[AssemblyAI] Connected to v3 API"
    end

    @ws.on :message do |msg|
      # Skip binary messages (ping frames, etc.)
      if msg.type == :binary || !msg.data.is_a?(String) || msg.data.empty?
        Rails.logger.debug "[AssemblyAI] Received binary/empty message, skipping"
        return
      end
      
      # Skip if it doesn't look like JSON
      unless msg.data.strip.start_with?('{')
        Rails.logger.debug "[AssemblyAI] Non-JSON message: #{msg.data[0..50]}"
        return
      end
      
      data = JSON.parse(msg.data)
      client.send(:handle, data)
    rescue JSON::ParserError => e
      Rails.logger.warn "[AssemblyAI] JSON parse error: #{e.message}, data: #{msg.data[0..100]}"
    end

    @ws.on :error do |e|
      Rails.logger.error "[AssemblyAI] Error: #{e.message}"
    end

    @ws.on :close do |e|
      if e.respond_to?(:code)
        Rails.logger.info "[AssemblyAI] Connection closed: #{e.code} #{e.reason}"
      else
        Rails.logger.info "[AssemblyAI] Connection closed: #{e.class} #{e.message rescue nil}"
      end
    end
  end

  def handle(data)
    case data["type"]
    when "Begin"
      Rails.logger.info "[AssemblyAI] Session started: #{data['id']}, expires_at: #{data['expires_at']}"
    when "Turn"
      # v3 API uses Turn with turn_is_formatted flag
      event = if data["turn_is_formatted"]
        { type: "stt_output", transcript: data["transcript"] }
      else
        { type: "stt_chunk", transcript: data["transcript"] }
      end

      return if event[:transcript].blank?

      @mutex.synchronize do
        @callbacks.each { |cb| cb.call(event) }
      end
    when "Termination"
      Rails.logger.info "[AssemblyAI] Session terminated: #{data['reason']}"
    else
      Rails.logger.debug "[AssemblyAI] Unknown message type: #{data['type']}"
    end
  end
end
