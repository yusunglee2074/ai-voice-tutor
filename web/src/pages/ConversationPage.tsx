import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { apiClient } from '../api/client'
import { useConversation } from '../hooks/useConversation'
import { useAudioCapture } from '../hooks/useAudioCapture'
import { useAudioPlayer } from '../hooks/useAudioPlayer'
import {
  ConversationHeader,
  MessageList,
  RecordingControls,
} from '../components/conversation'

export default function ConversationPage() {
  const { user, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [isInitialized, setIsInitialized] = useState(false)

  const { data: memberships, isLoading: membershipsLoading } = useQuery({
    queryKey: ['userMemberships', user?.id],
    queryFn: () => apiClient.getUserMemberships(user!.id),
    enabled: !!user,
  })

  const hasActiveMembership = memberships?.some((m) => m.is_active) || false
  const hasConversationFeature = memberships?.some(
    (m) => m.is_active && m.membership_type.features.includes('대화')
  )

  // WebSocket conversation hook
  const {
    messages,
    state,
    currentTranscript,
    connect,
    disconnect,
    sendAudio,
    sendEndOfSpeech,
    error: conversationError,
  } = useConversation()

  // Audio player hook
  const { playAudio } = useAudioPlayer()

  // Audio capture hook
  const {
    isRecording: isCapturing,
    startRecording,
    stopRecording,
    error: audioError,
    audioLevel,
  } = useAudioCapture({
    onAudioData: sendAudio,
  })

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/')
    }
  }, [authLoading, user, navigate])

  useEffect(() => {
    if (!membershipsLoading && !hasActiveMembership) {
      alert('활성화된 멤버십이 없습니다. 멤버십을 구매해주세요.')
      navigate('/memberships')
    }
  }, [membershipsLoading, hasActiveMembership, navigate])

  useEffect(() => {
    if (!membershipsLoading && hasActiveMembership && !hasConversationFeature) {
      alert('대화 기능이 포함된 멤버십이 필요합니다.')
      navigate('/')
    }
  }, [membershipsLoading, hasActiveMembership, hasConversationFeature, navigate])

  // Initialize WebSocket connection
  useEffect(() => {
    if (user && hasActiveMembership && hasConversationFeature && !isInitialized) {
      connect()
      setIsInitialized(true)
    }

    return () => {
      if (isInitialized) {
        disconnect()
      }
    }
  }, [user, hasActiveMembership, hasConversationFeature, isInitialized, connect, disconnect])

  // Handle audio playback from TTS
  useEffect(() => {
    // Audio playback is now handled by useAudioPlayer hook via custom events
    // No need for additional message handling here
  }, [playAudio])

  const handleStartRecording = async () => {
    if (state === 'idle' && !isCapturing) {
      await startRecording()
    }
  }

  const handleStopRecording = () => {
    if (isCapturing) {
      stopRecording()
      sendEndOfSpeech()
    }
  }

  const handleCancel = () => {
    if (isCapturing) {
      stopRecording()
    }
  }

  if (authLoading || membershipsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">로딩 중...</div>
      </div>
    )
  }

  if (!user || !hasActiveMembership || !hasConversationFeature) {
    return null
  }

  const error = conversationError || audioError

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans">
      <ConversationHeader onBack={() => navigate(-1)} />

      <MessageList
        messages={messages}
        currentTranscript={currentTranscript}
        error={error}
      />

      <RecordingControls
        isRecording={isCapturing}
        state={state}
        audioLevel={audioLevel}
        onStartRecording={handleStartRecording}
        onStopRecording={handleStopRecording}
        onCancel={handleCancel}
      />
    </div>
  )
}
