require "rails_helper"

RSpec.describe AssemblyAiClient do
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
    it "sets default sample rate to 16000" do
      expect(client.instance_variable_get(:@sample_rate)).to eq(16000)
    end

    it "accepts custom sample rate" do
      custom_client = described_class.new(sample_rate: 24000)
      expect(custom_client.instance_variable_get(:@sample_rate)).to eq(24000)
    end

    it "initializes callbacks array" do
      expect(client.instance_variable_get(:@callbacks)).to eq([])
    end
  end

  describe "#send_audio" do
    it "sends binary audio data" do
      audio_data = [1, 2, 3, 4].pack("C*")

      expect(mock_ws).to receive(:send).with(audio_data, type: :binary)
      client.send_audio(audio_data)
    end

    it "does not send when closed" do
      client.instance_variable_set(:@closed, true)

      expect(mock_ws).not_to receive(:send)
      client.send_audio([1, 2, 3])
    end

    it "does not send when WebSocket is not open" do
      allow(mock_ws).to receive(:open?).and_return(false)

      expect(mock_ws).not_to receive(:send)
      client.send_audio([1, 2, 3])
    end

    context "when send fails" do
      before do
        allow(mock_ws).to receive(:send).and_raise(Errno::EPIPE)
      end

      it "handles disconnect gracefully" do
        expect(Rails.logger).to receive(:warn).with(/Send failed/).ordered
        expect(Rails.logger).to receive(:warn).with(/Connection lost/).ordered
        client.send_audio([1, 2, 3])
      end
    end
  end

  describe "#force_endpoint" do
    it "sends ForceEndpoint message" do
      expect(mock_ws).to receive(:send).with({ type: "ForceEndpoint" }.to_json)
      client.force_endpoint
    end

    it "does not send when closed" do
      client.instance_variable_set(:@closed, true)

      expect(mock_ws).not_to receive(:send)
      client.force_endpoint
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
    it "sends Terminate message" do
      expect(mock_ws).to receive(:send).with({ type: "Terminate" }.to_json)
      client.close
    end

    it "closes WebSocket connection" do
      expect(mock_ws).to receive(:close)
      client.close
    end

    it "sets closed flag" do
      client.close
      expect(client.instance_variable_get(:@closed)).to be true
    end

    it "handles errors gracefully" do
      allow(mock_ws).to receive(:send).and_raise(StandardError.new("Error"))

      expect { client.close }.not_to raise_error
    end
  end

  describe "message handling" do
    let(:client) { described_class.new }

    before do
      allow(WebSocket::Client::Simple).to receive(:connect) do |url, options|
        @on_message_callback = nil
        mock_ws.tap do |ws|
          allow(ws).to receive(:on).with(:message) do |&block|
            @on_message_callback = block
          end
        end
      end
      client # trigger initialization
    end

    it "handles Turn message with transcript" do
      callback_received = nil
      client.on_event { |event| callback_received = event }

      message = double(
        data: { type: "Turn", transcript: "Hello world", turn_is_formatted: true }.to_json,
        type: :text
      )

      @on_message_callback&.call(message)

      expect(callback_received).to eq({ type: "stt_output", transcript: "Hello world" })
    end

    it "handles Begin message" do
      message = double(
        data: { type: "Begin", id: "session_123", expires_at: "2024-01-01" }.to_json,
        type: :text
      )

      expect(Rails.logger).to receive(:info).with(/Session started/)
      @on_message_callback&.call(message)
    end

    it "skips empty transcripts" do
      callback_received = nil
      client.on_event { |event| callback_received = event }

      message = double(
        data: { type: "Turn", transcript: "", turn_is_formatted: true }.to_json,
        type: :text
      )

      @on_message_callback&.call(message)

      expect(callback_received).to be_nil
    end

    it "handles JSON parse errors" do
      message = double(data: "invalid json", type: :text)

      allow(message.data).to receive(:is_a?).with(String).and_return(true)
      allow(message.data).to receive(:include?).and_return(false)
      allow(message.data).to receive(:empty?).and_return(false)
      allow(message.data).to receive(:strip).and_return(message.data)
      allow(message.data).to receive(:start_with?).with("{").and_return(true)
      allow(message.data).to receive(:[]).and_return("i")

      expect(Rails.logger).to receive(:warn).with(/JSON parse error/)
      @on_message_callback&.call(message)
    end
  end
end
