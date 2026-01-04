import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from './useAuth'

interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

type SessionState = 'disconnected' | 'idle' | 'processing'

interface ServerEvent {
  type: 'stt_chunk' | 'stt_output' | 'llm_chunk' | 'llm_end' | 'tts_chunk' | 'error'
  ts: number
  transcript?: string
  text?: string
  audio?: string
  message?: string
}

interface UseConversationResult {
  messages: ConversationMessage[]
  state: SessionState
  currentTranscript: string
  connect: () => void
  disconnect: () => void
  sendAudio: (audioData: ArrayBuffer) => void
  sendEndOfSpeech: () => void
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

  // Use ref to avoid stale closure in WebSocket callbacks
  const handleServerEventRef = useRef<(data: ServerEvent) => void>(() => {})

  handleServerEventRef.current = (data: ServerEvent) => {
    console.log('[WebSocket] Received event:', data.type, data)

    switch (data.type) {
      case 'stt_chunk':
        if (data.transcript) {
          setCurrentTranscript(data.transcript)
        }
        break

      case 'stt_output':
        if (data.transcript) {
          setCurrentTranscript(data.transcript)
        }
        break

      case 'llm_chunk':
        if (data.text) {
          currentAssistantMessageRef.current += data.text
        }
        break

      case 'llm_end':
        if (currentAssistantMessageRef.current) {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: currentAssistantMessageRef.current,
              timestamp: Date.now(),
            },
          ])
          currentAssistantMessageRef.current = ''
        }
        setState('idle')
        break

      case 'tts_chunk':
        if (data.audio) {
          window.dispatchEvent(
            new CustomEvent('tts_audio', { detail: data.audio })
          )
        }
        break

      case 'error':
        setError(data.message || 'Unknown error')
        setState('idle')
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

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//localhost:3000/ws`)
      ws.binaryType = 'arraybuffer'
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[WebSocket] Connected to /ws')
        setState('idle')
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
        console.error('[WebSocket] Error:', event)
        setError('WebSocket connection error')
        setState('disconnected')
      }

      ws.onclose = (event) => {
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Small delay to handle React StrictMode double-invocation
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
    error,
  }
}
