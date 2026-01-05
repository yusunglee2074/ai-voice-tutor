# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a real-time voice conversation application for English tutoring, built with Rails (backend) and React + Vite (frontend). The system implements a voice pipeline: Speech-to-Text (STT) → Large Language Model (LLM) → Text-to-Speech (TTS).

**Key Architecture:**
- **Backend:** Rails 8.1 API-only server with raw WebSocket middleware (not Action Cable)
- **Frontend:** React 19 + TypeScript + Vite + TailwindCSS 4
- **Voice Pipeline:** AssemblyAI v3 (STT) → Google Gemini 2.5 Flash Lite (LLM) → Cartesia sonic-3 (TTS)
- **WebSocket Protocol:** Binary PCM audio streaming over `/ws` endpoint
- **Database:** SQLite3 with membership management system

## Development Commands

### Initial Setup
```bash
make setup          # Install dependencies and setup database
```

### Running the Application

**IMPORTANT:** The servers are typically already running via `make dev` in a separate terminal session managed by the user. Claude Code should NOT start new server instances unless explicitly requested.

#### Viewing Server Logs
Since the servers run in a user-managed terminal, you can view logs using:

```bash
# View Rails logs (real-time)
tail -f server/log/development.log

# View recent Rails logs
tail -100 server/log/development.log

# Search Rails logs for specific events
grep "WebSocket" server/log/development.log
grep "ERROR" server/log/development.log
```

**Note:** After killing processes, inform the user to restart with `make dev` in their terminal.

#### Manual Server Start (If Not Running)
```bash
make dev            # Run both frontend and backend servers concurrently
npm run dev         # Alternative: run from root (uses concurrently)

# Or run individually:
cd server && bin/rails s -p 3000    # Backend on port 3000
cd web && npm run dev               # Frontend on port 5173
```

### Backend (Rails)
```bash
cd server
bundle install                      # Install Ruby dependencies
bin/rails db:prepare db:seed        # Setup database with seed data
bin/rails s -p 3000                 # Start server
bin/rails c                         # Rails console
bin/rails routes                    # Show all routes
rspec                               # Run all tests
rspec spec/models                   # Run model tests
rspec spec/requests                 # Run request specs
rubocop                             # Run linter
```

### Frontend (React + Vite)
```bash
cd web
npm install                         # Install dependencies
npm run dev                         # Start dev server (port 5173)
npm run build                       # Build for production
npm run lint                        # Run ESLint
npm test                            # Run Vitest tests (watch mode)
npm run test:run                    # Run tests once
npm run test:coverage               # Run tests with coverage
```

### Docker
```bash
make docker-up      # Build and run containers
make docker-down    # Stop containers
```

## Architecture Details

### WebSocket Voice Pipeline

The application uses a **raw WebSocket** connection (not Action Cable) at `/ws` for real-time voice communication:

1. **Client → Server:** Binary PCM audio (16kHz, 16-bit signed LE, mono) + JSON control messages
2. **Server Processing:** Audio → AssemblyAI STT → Gemini LLM → Cartesia TTS
3. **Server → Client:** JSON events with Base64-encoded TTS audio (24kHz PCM)

**Key Implementation Files:**
- `server/lib/voice_websocket_middleware.rb` - Raw WebSocket middleware using faye-websocket
- `server/app/services/voice_session.rb` - Session orchestration
- `server/app/services/assembly_ai_client.rb` - STT client (AssemblyAI v3 with format_turns)
- `server/app/services/llm_service.rb` - LLM client (Gemini streaming API)
- `server/app/services/cartesia_client.rb` - TTS client (Cartesia WebSocket API)
- `web/src/hooks/useConversation.ts` - WebSocket client hook
- `web/src/hooks/useAudioCapture.ts` - Microphone capture with AudioWorklet
- `web/src/hooks/useAudioPlayer.ts` - TTS audio playback with Web Audio API

**WebSocket Event Flow:**
```
Client sends: Binary PCM chunks → { type: "end_of_speech" }
Server sends: stt_chunk → stt_output → llm_chunk → llm_end → tts_chunk → tts_end
```

See `AUDIO_SPEC.md` for complete protocol specification.

### Backend Structure

**Rails Configuration:**
- API-only mode (no views/assets)
- Custom middleware: `VoiceWebsocketMiddleware` registered in `config/application.rb`
- CORS enabled via `rack-cors` gem
- SQLite3 database with Solid Cache/Queue/Cable

**Models:**
- `User` - User accounts with email/password
- `MembershipType` - Subscription plans (Basic, Premium, Enterprise)
- `UserMembership` - Join table for user subscriptions

**API Routes (REST):**
- `POST /api/v1/sessions` - Mock authentication
- `GET /api/v1/membership_types` - Public membership types
- `GET /api/v1/users/:id/memberships` - User's memberships
- Admin namespace: `/api/v1/admin/*` for CRUD operations

**WebSocket Route:**
- `/ws` - Voice conversation WebSocket (handled by middleware, not Rails router)

### Frontend Structure

**Key Directories:**
- `web/src/hooks/` - Custom React hooks (auth, audio, conversation)
- `web/src/components/` - Reusable UI components
- `web/src/pages/` - Page components (memberships, admin)
- `web/src/api/` - API client utilities

**State Management:**
- React Query (`@tanstack/react-query`) for server state
- React hooks for local state
- Custom hooks for WebSocket and audio management

**Testing:**
- Vitest + Testing Library for unit/integration tests
- Test files colocated with source files (`.test.ts`, `.test.tsx`)

## Environment Variables

Create `server/.env` with:
```bash
GEMINI_API_KEY=your_gemini_api_key
ASSEMBLYAI_API_KEY=your_assemblyai_api_key
CARTESIA_API_KEY=your_cartesia_api_key
CARTESIA_VOICE_ID=f6ff7c0c-e396-40a9-a70b-f7607edb6937  # Optional, has default
```

**API Key Sources:**
- Gemini: https://aistudio.google.com/app/apikey
- AssemblyAI: https://www.assemblyai.com/
- Cartesia: https://cartesia.ai/

## Important Implementation Notes

### Server Management
- **DO NOT start servers** - they are already running via `make dev` in a user-managed terminal
- To view logs, use `tail -f server/log/development.log` instead of starting new processes
- Only restart servers when explicitly requested or after changes to:
  - Middleware (`server/lib/voice_websocket_middleware.rb`)
  - Initializers (`server/config/initializers/`)
  - Application config (`server/config/application.rb`)
  - Gemfile changes requiring `bundle install`

### WebSocket Middleware
- The app uses **raw WebSocket** via `faye-websocket` gem, NOT Action Cable
- Middleware is registered in `config/application.rb` before Rails router
- Each WebSocket connection creates a new `VoiceSession` instance
- Sessions manage STT/LLM/TTS clients with event callbacks

### Audio Processing
- **Client-side:** AudioWorklet resamples microphone input to 16kHz PCM
- **Server-side:** Binary audio forwarded directly to AssemblyAI v3
- **TTS Output:** 24kHz PCM Base64-encoded in JSON events
- **Playback:** Web Audio API with queued buffer scheduling

### AssemblyAI v3 Specifics
- Uses `format_turns: true` parameter for better transcription formatting
- `ForceEndpoint` message finalizes current speech turn
- `Terminate` message closes connection gracefully
- Endpoint: `wss://streaming.assemblyai.com/v3/ws`

### LLM Integration
- Gemini 2.5 Flash Lite with streaming via SSE (Server-Sent Events)
- Conversation history maintained in `LlmService` instance
- System prompt: "You are a helpful English tutor. Be concise and encouraging."
- TTS generated from complete LLM response (not streamed chunks)

### Testing Strategy
- **Backend:** RSpec with FactoryBot for models and request specs
- **Frontend:** Vitest with Testing Library for component tests
- Mock external APIs (STT/LLM/TTS) in tests
- Use `rails_helper.rb` for Rails-specific test setup

## Common Development Tasks

### Adding a New API Endpoint
1. Add route in `server/config/routes.rb`
2. Create controller in `server/app/controllers/api/v1/`
3. Add request specs in `server/spec/requests/`
4. Update frontend API client in `web/src/api/client.ts`

### Modifying Voice Pipeline
1. Update service classes in `server/app/services/`
2. Modify event types in `web/src/hooks/useConversation.ts`
3. Update protocol documentation in `AUDIO_SPEC.md`
4. Test with real audio or mock WebSocket events

### Database Changes
```bash
cd server
bin/rails generate migration MigrationName
bin/rails db:migrate
bin/rails db:migrate RAILS_ENV=test
```

### Debugging WebSocket Issues
- Check Rails logs: `tail -f server/log/development.log` or `tail -100 server/log/development.log`
- Browser console: WebSocket events logged in `useConversation.ts`
- Test with `wscat`: `wscat -c ws://localhost:3000/ws`
- Verify middleware registration in `config/application.rb`
- Search logs for errors: `grep -i "error\|exception" server/log/development.log | tail -50`

## Access Information

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3000
- **Admin UI:** http://localhost:5173/admin
- **Admin Credentials:** admin@example.com / password123 (from seed data)

## Ruby Version

Ruby 3.4.8 (specified in `server/.ruby-version`)
