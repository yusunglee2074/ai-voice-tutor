import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { apiClient } from '../api/client'
import { useConversation } from '../hooks/useConversation'
import { useAudioCapture } from '../hooks/useAudioCapture'
import { useAudioPlayer } from '../hooks/useAudioPlayer'

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
    isConnected,
    isAiSpeaking,
    currentTranscript,
    connect,
    disconnect,
    sendAudio,
    finalizeTranscript,
    error: conversationError,
  } = useConversation()

  // Audio player hook
  const { playAudio } = useAudioPlayer()

  // Audio capture hook
  const {
    isRecording,
    startRecording,
    stopRecording,
    error: audioError,
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
    const handleMessage = (event: MessageEvent) => {
      const data = event.data
      if (data.type === 'tts_chunk' && data.audio) {
        playAudio(data.audio)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [playAudio])

  const handleMicToggle = async () => {
    if (isRecording) {
      stopRecording()
    } else {
      await startRecording()
    }
  }

  const handleFinalizeTranscript = () => {
    if (currentTranscript) {
      finalizeTranscript()
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
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold text-blue-600">
            Ringle
          </Link>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <span className="text-sm text-gray-600">
                {isConnected ? '연결됨' : '연결 끊김'}
              </span>
            </div>
            <span className="text-gray-700">{user.name}</span>
            <Link
              to="/"
              className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              홈으로
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold mb-4">AI와 대화하기</h1>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Status indicator */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-900">상태</p>
                <p className="text-sm text-blue-700">
                  {isRecording
                    ? '🎤 녹음 중...'
                    : isAiSpeaking
                    ? '🤖 AI가 말하는 중...'
                    : '대기 중'}
                </p>
              </div>
              {currentTranscript && (
                <div className="text-sm text-blue-700">
                  인식 중: "{currentTranscript}"
                </div>
              )}
            </div>
          </div>

          {/* Conversation messages */}
          <div className="border rounded-lg p-4 mb-6 h-96 overflow-y-auto bg-gray-50">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                대화를 시작하려면 마이크 버튼을 눌러주세요
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-gray-200'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <p
                        className={`text-xs mt-1 ${
                          message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                        }`}
                      >
                        {new Date(message.timestamp).toLocaleTimeString('ko-KR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex gap-4">
            <button
              onClick={handleMicToggle}
              disabled={!isConnected || isAiSpeaking}
              className={`flex-1 py-4 rounded-lg font-semibold transition-colors ${
                isRecording
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 disabled:cursor-not-allowed'
              }`}
            >
              {isRecording ? '🎤 녹음 중지' : '🎤 녹음 시작'}
            </button>

            <button
              onClick={handleFinalizeTranscript}
              disabled={!currentTranscript || isAiSpeaking}
              className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              ✓ 답변 완료
            </button>
          </div>

          <div className="mt-6 bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold mb-2 text-sm">사용 방법:</h3>
            <ol className="space-y-1 text-gray-700 text-sm">
              <li>1. "녹음 시작" 버튼을 눌러 말하기 시작</li>
              <li>2. 말이 끝나면 "답변 완료" 버튼 클릭</li>
              <li>3. AI가 응답을 생성하고 음성으로 답변</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
