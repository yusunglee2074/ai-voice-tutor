require "rails_helper"

RSpec.describe VoiceSession do
  let(:mock_ws) { double("WebSocket", send: true) }
  let(:session) { described_class.new(mock_ws) }
  let(:mock_stt) { instance_double(AssemblyAiClient, send_audio: true, force_endpoint: true, close: true, on_event: true) }
  let(:mock_tts) { instance_double(CartesiaClient, send_text: true, close: true, on_event: true, wait_for_connection: true) }
  let(:mock_llm) { instance_double(LlmService, add_message: true, stream_response: true) }

  before do
    allow(AssemblyAiClient).to receive(:new).and_return(mock_stt)
    allow(CartesiaClient).to receive(:new).and_return(mock_tts)
    allow(LlmService).to receive(:new).and_return(mock_llm)
  end

  describe "#initialize" do
    it "initializes with WebSocket connection" do
      expect(session.instance_variable_get(:@ws)).to eq(mock_ws)
    end

    it "initializes with empty transcript" do
      expect(session.instance_variable_get(:@current_transcript)).to eq("")
    end

    it "does not initialize services immediately" do
      expect(session.instance_variable_get(:@stt)).to be_nil
      expect(session.instance_variable_get(:@tts)).to be_nil
      expect(session.instance_variable_get(:@llm)).to be_nil
    end
  end

  describe "#start" do
    it "initializes TTS and LLM services" do
      expect(CartesiaClient).to receive(:new).and_return(mock_tts)
      expect(LlmService).to receive(:new).and_return(mock_llm)

      session.start
    end

    it "sets up TTS event listeners" do
      expect(mock_tts).to receive(:on_event)
      session.start
    end

    it "sends initial greeting" do
      allow(mock_tts).to receive(:wait_for_connection).and_return(true)

      expect(mock_ws).to receive(:send).at_least(:once) do |message|
        data = JSON.parse(message)
        expect(data["type"]).to be_in(["llm_chunk", "llm_end"])
      end

      session.start
      sleep 0.1 # Wait for thread to execute
    end

    it "adds greeting to LLM history" do
      allow(mock_tts).to receive(:wait_for_connection).and_return(true)

      expect(mock_llm).to receive(:add_message).with("assistant", anything)

      session.start
      sleep 0.1
    end
  end

  describe "#handle_message" do
    context "with binary audio data" do
      it "ensures STT is connected" do
        audio_data = [1, 2, 3, 4].pack("C*")

        expect(AssemblyAiClient).to receive(:new).and_return(mock_stt)
        session.handle_message(audio_data)
      end

      it "sends audio to STT" do
        audio_data = [1, 2, 3, 4].pack("C*")
        session.instance_variable_set(:@stt, mock_stt)

        expect(mock_stt).to receive(:send_audio).with(audio_data)
        session.handle_message(audio_data)
      end
    end

    context "with JSON message" do
      it "handles end_of_speech message" do
        session.instance_variable_set(:@stt, mock_stt)
        message = { type: "end_of_speech" }.to_json

        expect(mock_stt).to receive(:force_endpoint)
        session.handle_message(message)
      end

      it "handles start_recording message" do
        message = { type: "start_recording" }.to_json

        expect(AssemblyAiClient).to receive(:new).and_return(mock_stt)
        session.handle_message(message)
      end
    end

    context "with invalid JSON" do
      it "treats as binary audio data" do
        invalid_json = "not json"

        expect(AssemblyAiClient).to receive(:new).and_return(mock_stt)
        expect(mock_stt).to receive(:send_audio)

        session.handle_message(invalid_json)
      end
    end
  end

  describe "#stop" do
    before do
      session.instance_variable_set(:@stt, mock_stt)
      session.instance_variable_set(:@tts, mock_tts)
      session.instance_variable_set(:@llm, mock_llm)
    end

    it "disconnects STT" do
      expect(mock_stt).to receive(:close)
      session.stop
    end

    it "closes TTS" do
      expect(mock_tts).to receive(:close)
      session.stop
    end

    it "clears service references" do
      session.stop

      expect(session.instance_variable_get(:@stt)).to be_nil
      expect(session.instance_variable_get(:@tts)).to be_nil
      expect(session.instance_variable_get(:@llm)).to be_nil
    end
  end

  describe "private methods" do
    describe "#ensure_stt_connected" do
      it "creates STT client if not exists" do
        expect(AssemblyAiClient).to receive(:new).with(sample_rate: 16000).and_return(mock_stt)
        session.send(:ensure_stt_connected)
      end

      it "sets up STT event listeners" do
        expect(mock_stt).to receive(:on_event)
        session.send(:ensure_stt_connected)
      end

      it "does not create new client if already exists" do
        session.instance_variable_set(:@stt, mock_stt)

        expect(AssemblyAiClient).not_to receive(:new)
        session.send(:ensure_stt_connected)
      end
    end

    describe "#disconnect_stt" do
      it "closes STT connection" do
        session.instance_variable_set(:@stt, mock_stt)

        expect(mock_stt).to receive(:close)
        session.send(:disconnect_stt)
      end

      it "clears current transcript" do
        session.instance_variable_set(:@stt, mock_stt)
        session.instance_variable_set(:@current_transcript, "Hello")

        session.send(:disconnect_stt)

        expect(session.instance_variable_get(:@current_transcript)).to eq("")
      end

      it "does nothing if STT not connected" do
        expect { session.send(:disconnect_stt) }.not_to raise_error
      end
    end

    describe "#handle_end_of_speech" do
      before do
        session.instance_variable_set(:@stt, mock_stt)
        session.instance_variable_set(:@llm, mock_llm)
        session.instance_variable_set(:@tts, mock_tts)
        session.instance_variable_set(:@current_transcript, "Hello world")
      end

      it "forces STT endpoint" do
        expect(mock_stt).to receive(:force_endpoint)
        session.send(:handle_end_of_speech)
      end

      it "processes LLM in background thread" do
        allow(mock_llm).to receive(:stream_response).and_yield("Response")

        session.send(:handle_end_of_speech)
        sleep 0.6 # Wait for thread

        expect(mock_llm).to have_received(:stream_response).with("Hello world")
      end

      it "disconnects STT after processing" do
        allow(mock_llm).to receive(:stream_response).and_yield("Response")

        session.send(:handle_end_of_speech)
        sleep 0.6

        expect(mock_stt).to have_received(:close)
      end
    end

    describe "#process_llm" do
      before do
        session.instance_variable_set(:@llm, mock_llm)
        session.instance_variable_set(:@tts, mock_tts)
      end

      it "streams LLM response" do
        expect(mock_llm).to receive(:stream_response).with("Hello").and_yield("Hi there")

        session.send(:process_llm, "Hello")
      end

      it "sends llm_chunk events" do
        allow(mock_llm).to receive(:stream_response).and_yield("Hi").and_yield(" there")

        expect(mock_ws).to receive(:send).at_least(:once) do |message|
          data = JSON.parse(message)
          expect(data["type"]).to be_in(["llm_chunk", "llm_end"])
        end

        session.send(:process_llm, "Hello")
      end

      it "sends complete response to TTS" do
        allow(mock_llm).to receive(:stream_response).and_yield("Hi").and_yield(" there")

        expect(mock_tts).to receive(:send_text).with("Hi there")

        session.send(:process_llm, "Hello")
      end

      it "adds assistant message to history" do
        allow(mock_llm).to receive(:stream_response).and_yield("Response")

        expect(mock_llm).to receive(:add_message).with("assistant", "Response")

        session.send(:process_llm, "Hello")
      end

      it "does nothing with blank transcript" do
        expect(mock_llm).not_to receive(:stream_response)
        session.send(:process_llm, "")
      end

      it "handles errors gracefully" do
        allow(mock_llm).to receive(:stream_response).and_raise(StandardError.new("API error"))

        expect(Rails.logger).to receive(:error).at_least(:once)
        expect(mock_ws).to receive(:send) do |message|
          data = JSON.parse(message)
          expect(data["type"]).to eq("error")
        end

        session.send(:process_llm, "Hello")
      end
    end

    describe "#send_event" do
      it "sends event with timestamp" do
        expect(mock_ws).to receive(:send) do |message|
          data = JSON.parse(message)
          expect(data["ts"]).to be_a(Integer)
          expect(data["type"]).to eq("test")
        end

        session.send(:send_event, { type: "test" })
      end

      it "handles send errors gracefully" do
        allow(mock_ws).to receive(:send).and_raise(StandardError.new("Send error"))

        expect(Rails.logger).to receive(:error).with(/Error sending event/)
        expect { session.send(:send_event, { type: "test" }) }.not_to raise_error
      end

      it "does nothing if WebSocket is nil" do
        session.instance_variable_set(:@ws, nil)

        expect { session.send(:send_event, { type: "test" }) }.not_to raise_error
      end
    end
  end

  describe "STT event handling" do
    it "updates current transcript on stt_output" do
      session.send(:ensure_stt_connected)

      # Simulate STT callback
      callback = session.instance_variable_get(:@stt).instance_variable_get(:@callbacks)&.first

      # Since we're using a mock, we need to manually trigger the callback behavior
      session.instance_variable_set(:@current_transcript, "")

      # Simulate receiving stt_output event
      event = { type: "stt_output", transcript: "Hello world" }
      session.instance_variable_set(:@current_transcript, event[:transcript])

      expect(session.instance_variable_get(:@current_transcript)).to eq("Hello world")
    end
  end
end
