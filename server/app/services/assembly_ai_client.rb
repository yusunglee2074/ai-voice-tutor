require "websocket-client-simple"

class AssemblyAiClient
  ASSEMBLY_AI_API_KEY = ENV.fetch("ASSEMBLYAI_API_KEY", "test_key")
  ASSEMBLY_AI_WS_URL = "wss://streaming.assemblyai.com/v3/ws"

  def initialize(sample_rate: 16000)
    @callbacks = []
    @mutex = Mutex.new
    @sample_rate = sample_rate
    @closed = false
    connect
  end

  def send_audio(bytes)
    return if @closed
    return unless @ws&.open?
    begin
      @ws.send(bytes, type: :binary)
    rescue Errno::EPIPE, IOError => e
      Rails.logger.warn "[AssemblyAI] Send failed (connection closed): #{e.message}"
      handle_disconnect
    end
  end

  # AssemblyAI v3: Force endpoint to finalize current turn
  def force_endpoint
    return if @closed
    return unless @ws&.open?
    begin
      @ws.send({ type: "ForceEndpoint" }.to_json)
      Rails.logger.debug "[AssemblyAI] Sent ForceEndpoint"
    rescue Errno::EPIPE, IOError => e
      Rails.logger.warn "[AssemblyAI] ForceEndpoint failed: #{e.message}"
      handle_disconnect
    end
  end

  def on_event(&block)
    @mutex.synchronize { @callbacks << block }
  end

  def close
    @closed = true
    return unless @ws
    begin
      if @ws.open?
        @ws.send({ type: "Terminate" }.to_json)
        sleep 0.1 # Give time for graceful termination
      end
    rescue => e
      Rails.logger.debug "[AssemblyAI] Error during close: #{e.message}"
    ensure
      @ws.close rescue nil
      @ws = nil
    end
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
      begin
        # Handle ping/pong frames - these are text messages from the WebSocket library
        if msg.data.is_a?(String) && (msg.data == "keepalive ping timeout" || msg.data.include?("ping") || msg.data.include?("pong"))
          Rails.logger.debug "[AssemblyAI] Keepalive message: #{msg.data}"
          next  # Use 'next' instead of 'return' in blocks
        end

        # Skip binary messages (actual ping frames)
        if msg.type == :binary || !msg.data.is_a?(String) || msg.data.empty?
          Rails.logger.debug "[AssemblyAI] Received binary/empty message, skipping"
          next  # Use 'next' instead of 'return' in blocks
        end

        # Skip if it doesn't look like JSON
        unless msg.data.strip.start_with?("{")
          Rails.logger.debug "[AssemblyAI] Non-JSON message: #{msg.data[0..50]}"
          next  # Use 'next' instead of 'return' in blocks
        end

        data = JSON.parse(msg.data)
        client.send(:handle, data)
      rescue JSON::ParserError => e
        Rails.logger.warn "[AssemblyAI] JSON parse error: #{e.message}, data: #{msg.data[0..100]}"
      rescue => e
        Rails.logger.error "[AssemblyAI] Message handler error: #{e.class} - #{e.message}"
      end
    end

    @ws.on :error do |e|
      Rails.logger.error "[AssemblyAI] WebSocket error: #{e.message}"
      client.send(:handle_disconnect)
    end

    @ws.on :close do |e|
      if e.respond_to?(:code)
        Rails.logger.info "[AssemblyAI] Connection closed: #{e.code} #{e.reason}"
      else
        Rails.logger.info "[AssemblyAI] Connection closed: #{e.class} #{e.message rescue nil}"
      end
      client.send(:handle_disconnect)
    end
  end

  def handle_disconnect
    return if @closed
    @ws = nil
    Rails.logger.warn "[AssemblyAI] Connection lost, notifying callbacks"

    # Notify callbacks about disconnection
    @mutex.synchronize do
      @callbacks.each do |cb|
        cb.call({ type: "error", message: "STT connection lost" }) rescue nil
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
