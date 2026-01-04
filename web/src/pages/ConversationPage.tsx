import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { apiClient } from '../api/client'

export default function ConversationPage() {
  const { user, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()

  const { data: memberships, isLoading: membershipsLoading } = useQuery({
    queryKey: ['userMemberships', user?.id],
    queryFn: () => apiClient.getUserMemberships(user!.id),
    enabled: !!user,
  })

  const hasActiveMembership = memberships?.some((m) => m.is_active) || false
  const hasConversationFeature = memberships?.some(
    (m) => m.is_active && m.membership_type.features.includes('대화')
  )

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

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold text-blue-600">
            Ringle
          </Link>
          <div className="flex items-center gap-4">
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

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-blue-900 mb-2">
              🎙️ 음성 대화 기능
            </h2>
            <p className="text-blue-800 mb-4">
              실시간 음성 대화 기능은 Phase 4, 5에서 구현될 예정입니다.
            </p>
            <ul className="space-y-2 text-blue-800 text-sm">
              <li>• Phase 4: 백엔드 오디오 파이프라인 (WebSocket, STT, LLM, TTS)</li>
              <li>• Phase 5: 프론트엔드 오디오 (AudioWorklet, Web Audio API)</li>
            </ul>
          </div>

          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <div className="text-gray-400 mb-4">
                <svg
                  className="w-16 h-16 mx-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                </svg>
              </div>
              <p className="text-gray-600 mb-2">마이크 버튼</p>
              <p className="text-sm text-gray-500">
                음성 인식 및 파형 시각화 (구현 예정)
              </p>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <div className="text-gray-400 mb-4">
                <svg
                  className="w-16 h-16 mx-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <p className="text-gray-600 mb-2">대화 내용</p>
              <p className="text-sm text-gray-500">
                AI 응답 텍스트 스트리밍 표시 (구현 예정)
              </p>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <div className="text-gray-400 mb-4">
                <svg
                  className="w-16 h-16 mx-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <p className="text-gray-600 mb-2">"답변 완료" 버튼</p>
              <p className="text-sm text-gray-500">
                STT 확정 및 LLM 요청 트리거 (구현 예정)
              </p>
            </div>
          </div>

          <div className="mt-8 bg-gray-50 rounded-lg p-6">
            <h3 className="font-semibold mb-3">구현 예정 기능:</h3>
            <ul className="space-y-2 text-gray-700 text-sm">
              <li>✓ 멤버십 검증 및 Route Guard (완료)</li>
              <li>• WebSocket 연결 및 실시간 통신</li>
              <li>• 마이크 입력 및 16kHz PCM 변환</li>
              <li>• AssemblyAI 실시간 STT</li>
              <li>• LLM 스트리밍 응답</li>
              <li>• Cartesia TTS 및 오디오 재생</li>
              <li>• 음성 인식 중 파형 시각화</li>
              <li>• 대화 히스토리 표시</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
