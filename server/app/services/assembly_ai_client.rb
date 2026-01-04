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
  end

  # AssemblyAI v3: Force endpoint to finalize current turn
  def force_endpoint
    return unless @ws&.open?
    @ws.send({ type: "force_endpoint" }.to_json)
    Rails.logger.debug "[AssemblyAI] Sent force_endpoint"
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
      sample_rate: @sample_rate,
      format_turns: true
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
      client.send(:handle, JSON.parse(msg.data))
    rescue JSON::ParserError => e
      Rails.logger.error "[AssemblyAI] Parse error: #{e.message}"
    end

    @ws.on :error do |e|
      Rails.logger.error "[AssemblyAI] Error: #{e.message}"
    end

    @ws.on :close do |e|
      Rails.logger.info "[AssemblyAI] Connection closed: #{e&.code} #{e&.reason}"
    end
  end

  def handle(data)
    return unless data["type"] == "Turn"

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
  end
end
