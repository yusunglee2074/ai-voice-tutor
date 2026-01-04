import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from './useAuth'

interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface UseConversationResult {
  messages: ConversationMessage[]
  isConnected: boolean
  isAiSpeaking: boolean
  currentTranscript: string
  connect: () => void
  disconnect: () => void
  sendAudio: (audioData: ArrayBuffer) => void
  finalizeTranscript: () => void
  error: string | null
}

export function useConversation(): UseConversationResult {
  const { user } = useAuth()
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)

  const cableRef = useRef<any>(null)
  const subscriptionRef = useRef<any>(null)
  const currentAssistantMessageRef = useRef('')

  const connect = useCallback(() => {
    if (!user) {
      setError('User not authenticated')
      return
    }

    try {
      // Create ActionCable connection
      const cable = window.ActionCable.createConsumer(
        `ws://localhost:3000/cable?user_id=${user.id}`
      )
      cableRef.current = cable

      // Subscribe to ConversationChannel
      const subscription = cable.subscriptions.create(
        {
          channel: 'ConversationChannel',
          user_id: user.id,
        },
        {
          connected() {
            console.log('[WebSocket] Connected to conversation channel')
            setIsConnected(true)
            setError(null)
          },

          disconnected() {
            console.log('[WebSocket] Disconnected from conversation channel')
            setIsConnected(false)
          },

          received(data: any) {
            handleMessage(data)
          },
        }
      )

      subscriptionRef.current = subscription
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect'
      setError(errorMessage)
      console.error('Error connecting to WebSocket:', err)
    }
  }, [user])

  const disconnect = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe()
      subscriptionRef.current = null
    }

    if (cableRef.current) {
      cableRef.current.disconnect()
      cableRef.current = null
    }

    setIsConnected(false)
    setCurrentTranscript('')
    currentAssistantMessageRef.current = ''
  }, [])

  const sendAudio = useCallback((audioData: ArrayBuffer) => {
    if (!subscriptionRef.current || !isConnected) return

    // Convert ArrayBuffer to base64
    const bytes = new Uint8Array(audioData)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    const base64 = btoa(binary)

    subscriptionRef.current.send({
      type: 'audio',
      audio: base64,
    })
  }, [isConnected])

  const finalizeTranscript = useCallback(() => {
    if (!subscriptionRef.current || !isConnected) return

    subscriptionRef.current.send({
      type: 'finalize_transcript',
    })

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
  }, [isConnected, currentTranscript])

  const handleMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'stt_chunk':
        setCurrentTranscript(data.transcript)
        break

      case 'stt_output':
        setCurrentTranscript(data.transcript)
        break

      case 'llm_chunk':
        currentAssistantMessageRef.current += data.text
        setIsAiSpeaking(true)
        break

      case 'llm_end':
        // Add complete assistant message to conversation
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
        setIsAiSpeaking(false)
        break

      case 'tts_chunk':
        // Audio playback is handled by useAudioPlayer hook
        break

      case 'error':
        setError(data.message)
        setIsAiSpeaking(false)
        break

      default:
        console.warn('[WebSocket] Unknown message type:', data.type)
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    messages,
    isConnected,
    isAiSpeaking,
    currentTranscript,
    connect,
    disconnect,
    sendAudio,
    finalizeTranscript,
    error,
  }
}
