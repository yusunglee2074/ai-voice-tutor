import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from './useAuth'

interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

type SessionState = 'disconnected' | 'listening' | 'processing' | 'speaking'

interface ServerEvent {
  type: 'stt_chunk' | 'stt_output' | 'llm_chunk' | 'llm_end' | 'tts_chunk' | 'tts_end' | 'interrupted' | 'error'
  ts: number
  transcript?: string
  text?: string
  audio?: string
  message?: string
  tts_generation?: number
}

interface UseConversationResult {
  messages: ConversationMessage[]
  state: SessionState
  currentTranscript: string
  connect: () => void
  disconnect: () => void
  sendAudio: (audioData: ArrayBuffer) => void
  sendEndOfSpeech: () => void
  sendStartRecording: () => void
  sendAutoEndOfSpeech: () => void
  sendInterrupt: () => void
  error: string | null
}

export function useConversation(): UseConversationResult {
  const { user } = useAuth()
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [state, setState] = useState<SessionState>('disconnected')
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const currentAssistantMessageRef = useRef('')
  const intentionalDisconnectRef = useRef(false)
  const currentTtsGenerationRef = useRef(0)

  // Use ref to avoid stale closure in WebSocket callbacks
  const handleServerEventRef = useRef<(data: ServerEvent) => void>(() => { })
  const sendAutoEndOfSpeechRef = useRef<(transcript?: string) => void>(() => { })

  handleServerEventRef.current = (data: ServerEvent) => {
    console.log('[WebSocket] Received event:', data.type, data)

    switch (data.type) {
      case 'stt_chunk':
        if (data.transcript) {
          setCurrentTranscript(data.transcript)
        }
        break

      case 'stt_output':
        // Final formatted transcript from AssemblyAI
        // This indicates the user has finished speaking
        if (data.transcript) {
          console.log('[WebSocket] STT output received, auto-triggering LLM')

          // Display the transcript briefly
          setCurrentTranscript(data.transcript)

          // Automatically trigger LLM response
          // Use setTimeout to ensure React state updates complete
          setTimeout(() => {
            sendAutoEndOfSpeechRef.current(data.transcript)
          }, 0)
        }
        break

      case 'llm_chunk':
        if (data.text) {
          currentAssistantMessageRef.current += data.text
        }
        break

      case 'llm_end': {
        const finalMessage = currentAssistantMessageRef.current
        currentAssistantMessageRef.current = ''

        if (finalMessage) {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: finalMessage,
              timestamp: Date.now(),
            },
          ])
        }
        // Keep processing state until TTS starts
        break
      }
      case 'tts_chunk':
        if (data.audio) {
          // Check if this chunk is from the current generation
          const chunkGeneration = data.tts_generation ?? 0
          if (chunkGeneration < currentTtsGenerationRef.current) {
            console.log('[WebSocket] Ignoring old TTS chunk, generation:', chunkGeneration, 'current:', currentTtsGenerationRef.current)
            return
          }

          // First TTS chunk - transition to speaking state
          setState('speaking')
          window.dispatchEvent(
            new CustomEvent('tts_audio', {
              detail: {
                audio: data.audio,
                generation: chunkGeneration
              }
            })
          )
        }
        break

      case 'tts_end':
        // TTS playback completed, return to listening state
        setState('listening')
        break

      case 'interrupted':
        // Interruption acknowledged by server
        console.log('[WebSocket] Interruption acknowledged')

        // Update current generation to filter out old chunks
        if (data.tts_generation !== undefined) {
          currentTtsGenerationRef.current = data.tts_generation
          console.log('[WebSocket] Updated TTS generation to:', data.tts_generation)
        }

        setState('listening')
        break

      case 'error':
        setError(data.message || 'Unknown error')
        setState('listening')
        break

      default:
        console.warn('[WebSocket] Unknown message type:', data)
    }
  }

  const connect = useCallback(() => {
    if (!user) {
      setError('User not authenticated')
      return
    }

    // Reset intentional disconnect flag when connecting
    intentionalDisconnectRef.current = false

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = import.meta.env.VITE_WS_URL || `${protocol}//localhost:3000/ws`
      const ws = new WebSocket(wsUrl)
      ws.binaryType = 'arraybuffer'
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[WebSocket] Connected to /ws')
        setState('listening')
        setError(null)
      }

      ws.onmessage = (event) => {
        try {
          const data: ServerEvent = JSON.parse(event.data)
          handleServerEventRef.current(data)
        } catch (err) {
          console.error('[WebSocket] Failed to parse message:', err)
        }
      }

      ws.onerror = (event) => {
        if (intentionalDisconnectRef.current || wsRef.current !== ws) {
          return
        }
        console.error('[WebSocket] Error:', event)
        setError('WebSocket connection error')
        setState('disconnected')
      }

      ws.onclose = (event) => {
        // Only update state if this is still the current WebSocket
        if (wsRef.current !== ws && !intentionalDisconnectRef.current) {
          return
        }
        console.log('[WebSocket] Disconnected:', event.code, event.reason)
        setState('disconnected')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect'
      setError(errorMessage)
      console.error('Error connecting to WebSocket:', err)
    }
  }, [user])

  const disconnect = useCallback(() => {
    // Mark as intentional disconnect to suppress error messages
    intentionalDisconnectRef.current = true
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setState('disconnected')
    setCurrentTranscript('')
    currentAssistantMessageRef.current = ''
  }, [])

  const sendAudio = useCallback((audioData: ArrayBuffer) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocket] Cannot send audio: not connected')
      return
    }

    // Send binary PCM directly (no Base64 encoding!)
    wsRef.current.send(audioData)
  }, [])

  const sendEndOfSpeech = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocket] Cannot send end_of_speech: not connected')
      return
    }

    // Send JSON message
    wsRef.current.send(JSON.stringify({ type: 'end_of_speech' }))

    // Add user message to conversation
    if (currentTranscript) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'user',
          content: currentTranscript,
          timestamp: Date.now(),
        },
      ])
      setCurrentTranscript('')
    }

    setState('processing')
  }, [currentTranscript])

  const sendStartRecording = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocket] Cannot send start_recording: not connected')
      return
    }

    // Send JSON message to reconnect STT
    wsRef.current.send(JSON.stringify({ type: 'start_recording' }))
    console.log('[WebSocket] Sent start_recording event')
  }, [])

  const sendAutoEndOfSpeech = useCallback((transcript?: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocket] Cannot send auto_end_of_speech: not connected')
      return
    }

    // Use provided transcript or current transcript from state
    const finalTranscript = transcript || currentTranscript

    // Send JSON message
    wsRef.current.send(JSON.stringify({ type: 'auto_end_of_speech' }))
    console.log('[WebSocket] Sent auto_end_of_speech event')

    // Add user message to conversation
    if (finalTranscript) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'user',
          content: finalTranscript,
          timestamp: Date.now(),
        },
      ])
      setCurrentTranscript('')
    }

    setState('processing')
  }, [currentTranscript])

  // Keep ref updated to avoid stale closures
  sendAutoEndOfSpeechRef.current = sendAutoEndOfSpeech

  const sendInterrupt = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocket] Cannot send interrupt: not connected')
      return
    }

    // Send JSON message to interrupt TTS
    wsRef.current.send(JSON.stringify({ type: 'interrupt' }))
    console.log('[WebSocket] Sent interrupt event')

    // Clear current assistant message being generated
    currentAssistantMessageRef.current = ''
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Mark as intentional disconnect for cleanup
      intentionalDisconnectRef.current = true
      const ws = wsRef.current
      if (ws) {
        wsRef.current = null
        ws.close()
      }
    }
  }, [])

  return {
    messages,
    state,
    currentTranscript,
    connect,
    disconnect,
    sendAudio,
    sendEndOfSpeech,
    sendStartRecording,
    sendAutoEndOfSpeech,
    sendInterrupt,
    error,
  }
}
