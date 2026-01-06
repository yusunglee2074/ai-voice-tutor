import { useEffect, useState, useRef, useCallback } from 'react'
import { useConversation } from '../hooks/useConversation'
import { useAudioCapture } from '../hooks/useAudioCapture'
import { useAudioPlayer } from '../hooks/useAudioPlayer'
import {
  ConversationHeader,
  MessageList,
  RecordingControls,
} from '../components/conversation'

export default function ConversationPage() {
  const [isStarted, setIsStarted] = useState(false)

  // WebSocket conversation hook
  const {
    messages,
    state,
    currentTranscript,
    connect,
    disconnect,
    sendAudio,
    error: conversationError,
  } = useConversation()

  // Audio player hook
  const { isPlaying } = useAudioPlayer()

  // Use ref to track isPlaying for callback
  const isPlayingRef = useRef(isPlaying)
  isPlayingRef.current = isPlaying

  // Only send audio when TTS is not playing
  const handleAudioData = useCallback((audioData: ArrayBuffer) => {
    if (isPlayingRef.current) {
      // TTS is playing, don't send audio
      return
    }
    sendAudio(audioData)
  }, [sendAudio])

  // Audio capture hook
  const {
    startRecording,
    stopRecording,
    error: audioError,
    audioLevel,
  } = useAudioCapture({
    onAudioData: handleAudioData,
  })

  useEffect(() => {
    if (isStarted) {
      const startConversation = async () => {
        connect()
        // Start microphone capture automatically
        await startRecording()
      }
      startConversation()
    }
  }, [isStarted, connect, startRecording])

  // Cleanup on actual unmount (page navigation)
  useEffect(() => {
    return () => {
      stopRecording()
      disconnect()
    }
  }, [disconnect, stopRecording])

  const error = conversationError || audioError

  if (!isStarted) {
    return (
      <div className="flex flex-col h-screen bg-gray-50 font-sans">
        <ConversationHeader />
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <p className="text-gray-600 text-lg">영어 대화를 시작해보세요</p>
          <button
            onClick={() => setIsStarted(true)}
            className="px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            시작하기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans">
      <ConversationHeader />

      <MessageList
        messages={messages}
        currentTranscript={currentTranscript}
        error={error}
      />

      <RecordingControls
        state={state}
        audioLevel={audioLevel}
      />
    </div>
  )
}
