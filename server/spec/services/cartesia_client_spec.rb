require "rails_helper"

RSpec.describe CartesiaClient do
  let(:mock_ws) { double("WebSocket", open?: true, send: true, close: true) }
  let(:client) { described_class.new }

  before do
    allow(WebSocket::Client::Simple).to receive(:connect).and_return(mock_ws)
    allow(mock_ws).to receive(:on).with(:open).and_yield
    allow(mock_ws).to receive(:on).with(:message)
    allow(mock_ws).to receive(:on).with(:error)
    allow(mock_ws).to receive(:on).with(:close)
  end

  describe "#initialize" do
    it "initializes context counter to 0" do
      expect(client.instance_variable_get(:@context_counter)).to eq(0)
    end

    it "initializes callbacks array" do
      expect(client.instance_variable_get(:@callbacks)).to eq([])
    end
  end

  describe "#wait_for_connection" do
    it "returns true if already connected" do
      client.instance_variable_set(:@connected, true)

      expect(client.wait_for_connection(timeout: 1)).to be true
    end

    it "returns true when connection is established in background" do
      Thread.new do
        sleep 0.05
        client.send(:mark_connected)
      end

      expect(client.wait_for_connection(timeout: 1)).to be true
    end
  end

  describe "#send_text" do
    before do
      client.instance_variable_set(:@connected, true)
    end

    it "sends text to TTS service" do
      expect(mock_ws).to receive(:send) do |message|
        data = JSON.parse(message)
        expect(data["transcript"]).to eq("Hello world")
        expect(data["model_id"]).to eq("sonic-3")
        expect(data["language"]).to eq("ko")
      end

      client.send_text("Hello world")
    end

    it "increments context counter" do
      expect {
        client.send_text("Hello")
      }.to change { client.instance_variable_get(:@context_counter) }.by(1)
    end

    it "does not send blank text" do
      expect(mock_ws).not_to receive(:send)
      client.send_text("")
    end

    it "does not send when WebSocket is not open" do
      allow(mock_ws).to receive(:open?).and_return(false)

      expect(mock_ws).not_to receive(:send)
      client.send_text("Hello")
    end

    it "includes proper audio format configuration" do
      expect(mock_ws).to receive(:send) do |message|
        data = JSON.parse(message)
        expect(data["output_format"]["container"]).to eq("raw")
        expect(data["output_format"]["encoding"]).to eq("pcm_s16le")
        expect(data["output_format"]["sample_rate"]).to eq(24000)
      end

      client.send_text("Test")
    end
  end

  describe "#on_event" do
    it "registers callback" do
      callback_called = false
      client.on_event { |event| callback_called = true }

      callbacks = client.instance_variable_get(:@callbacks)
      expect(callbacks.length).to eq(1)
    end

    it "is thread-safe" do
      threads = 10.times.map do
        Thread.new { client.on_event { |event| } }
      end
      threads.each(&:join)

      callbacks = client.instance_variable_get(:@callbacks)
      expect(callbacks.length).to eq(10)
    end
  end

  describe "#close" do
    it "closes WebSocket connection" do
      expect(mock_ws).to receive(:close)
      client.close
    end

    it "sets WebSocket to nil" do
      client.close
      expect(client.instance_variable_get(:@ws)).to be_nil
    end

    it "handles nil WebSocket gracefully" do
      client.instance_variable_set(:@ws, nil)
      expect { client.close }.not_to raise_error
    end
  end

  describe "message handling" do
    let(:client) { described_class.new }

    before do
      allow(WebSocket::Client::Simple).to receive(:connect) do |url|
        @on_message_callback = nil
        mock_ws.tap do |ws|
          allow(ws).to receive(:on).with(:message) do |&block|
            @on_message_callback = block
          end
        end
      end
      client # trigger initialization
    end

    it "handles chunk message with audio data" do
      callback_received = nil
      client.on_event { |event| callback_received = event }

      message = double(
        data: { type: "chunk", data: "base64_audio_data" }.to_json
      )

      @on_message_callback&.call(message)

      expect(callback_received).to eq({ type: "tts_chunk", audio: "base64_audio_data" })
    end

    it "handles done message" do
      callback_received = nil
      client.on_event { |event| callback_received = event }

      message = double(
        data: { type: "done", context_id: "ctx_123" }.to_json
      )

      expect(Rails.logger).to receive(:info).with(/TTS generation completed/)
      @on_message_callback&.call(message)

      expect(callback_received).to eq({ type: "tts_end" })
    end

    it "handles unknown message types" do
      message = double(
        data: { type: "unknown" }.to_json
      )

      expect(Rails.logger).to receive(:debug).with(/Unknown message type/)
      @on_message_callback&.call(message)
    end

    it "handles JSON parse errors" do
      message = double(data: "invalid json")

      expect(Rails.logger).to receive(:error).with(/Parse error/)
      @on_message_callback&.call(message)
    end

    it "skips chunk messages without data" do
      callback_received = nil
      client.on_event { |event| callback_received = event }

      message = double(
        data: { type: "chunk" }.to_json
      )

      @on_message_callback&.call(message)

      expect(callback_received).to be_nil
    end
  end

  describe "#mark_connected" do
    it "sets connected flag to true" do
      client.send(:mark_connected)
      expect(client.instance_variable_get(:@connected)).to be true
    end

    it "broadcasts to waiting threads" do
      cv = client.instance_variable_get(:@connection_cv)
      expect(cv).to receive(:broadcast)

      client.send(:mark_connected)
    end
  end
end
