require "rails_helper"

RSpec.describe LlmService do
  let(:service) { described_class.new }

  describe "#initialize" do
    it "initializes with empty conversation history" do
      expect(service.history).to eq([])
    end
  end

  describe "#add_message" do
    it "adds user message to history" do
      service.add_message("user", "Hello")

      expect(service.history.length).to eq(1)
      expect(service.history.first[:role]).to eq("user")
      expect(service.history.first[:parts].first[:text]).to eq("Hello")
    end

    it "converts assistant role to model role" do
      service.add_message("assistant", "Hi there")

      expect(service.history.first[:role]).to eq("model")
    end
  end

  describe "#clear_history" do
    it "clears conversation history" do
      service.add_message("user", "Hello")
      service.clear_history

      expect(service.history).to eq([])
    end
  end

  describe "#get_response" do
    let(:mock_response) do
      double(
        success?: true,
        body: {
          "candidates" => [
            {
              "content" => {
                "parts" => [
                  { "text" => "This is a response" }
                ]
              }
            }
          ]
        }
      )
    end

    before do
      allow_any_instance_of(Faraday::Connection).to receive(:post).and_return(mock_response)
    end

    it "returns assistant response" do
      response = service.get_response("Hello")

      expect(response).to eq("This is a response")
    end

    it "adds both user and assistant messages to history" do
      service.get_response("Hello")

      expect(service.history.length).to eq(2)
      expect(service.history[0][:role]).to eq("user")
      expect(service.history[1][:role]).to eq("model")
    end

    context "when API call fails" do
      let(:error_response) do
        double(success?: false, status: 500, body: "Error")
      end

      before do
        allow_any_instance_of(Faraday::Connection).to receive(:post).and_return(error_response)
      end

      it "returns nil" do
        expect(service.get_response("Hello")).to be_nil
      end
    end

    context "when network error occurs" do
      before do
        allow_any_instance_of(Faraday::Connection).to receive(:post).and_raise(Faraday::Error.new("Network error"))
      end

      it "returns nil and logs error" do
        expect(Rails.logger).to receive(:error).with(/Gemini API Error/)
        expect(service.get_response("Hello")).to be_nil
      end
    end
  end

  describe "#stream_response" do
    let(:mock_response) { double(Faraday::Response) }

    before do
      allow_any_instance_of(Faraday::Connection).to receive(:post).and_return(mock_response)
    end

    it "adds user message to history" do
      service.stream_response("Hello") { |chunk| }

      expect(service.history.last[:role]).to eq("user")
      expect(service.history.last[:parts].first[:text]).to eq("Hello")
    end

    context "when API error occurs" do
      before do
        allow_any_instance_of(Faraday::Connection).to receive(:post).and_raise(Faraday::Error.new("API error"))
      end

      it "raises error and logs" do
        expect(Rails.logger).to receive(:error).with(/Gemini API Error/)
        expect { service.stream_response("Hello") { |chunk| } }.to raise_error(Faraday::Error)
      end
    end
  end
end
