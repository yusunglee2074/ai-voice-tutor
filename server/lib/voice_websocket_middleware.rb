require "faye/websocket"

class VoiceWebsocketMiddleware
  def initialize(app)
    @app = app
  end

  def call(env)
    if Faye::WebSocket.websocket?(env) && env["PATH_INFO"] == "/ws"
      ws = Faye::WebSocket.new(env)
      session = VoiceSession.new(ws)

      ws.on :open do |_event|
        Rails.logger.info "[WebSocket] Client connected"
        session.start
      end

      ws.on :message do |event|
        session.handle_message(event.data)
      end

      ws.on :close do |event|
        Rails.logger.info "[WebSocket] Client disconnected: #{event.code} #{event.reason}"
        session.stop
      end

      ws.on :error do |event|
        Rails.logger.error "[WebSocket] Error: #{event.message}"
      end

      # Return async Rack response
      ws.rack_response
    else
      @app.call(env)
    end
  end
end
