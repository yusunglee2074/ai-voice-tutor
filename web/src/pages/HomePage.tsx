import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { apiClient } from '../api/client'

export default function HomePage() {
  const { user, login, logout, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  const { data: memberships, isLoading: membershipsLoading } = useQuery({
    queryKey: ['userMemberships', user?.id],
    queryFn: () => apiClient.getUserMemberships(user!.id),
    enabled: !!user,
  })

  const { data: membershipTypes } = useQuery({
    queryKey: ['membershipTypes'],
    queryFn: () => apiClient.getMembershipTypes(),
  })

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoggingIn(true)
    try {
      await login(email)
    } catch (error) {
      alert('로그인 실패: 사용자를 찾을 수 없습니다.')
    } finally {
      setIsLoggingIn(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">로딩 중...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-center mb-2">AI 영어튜터</h1>
          <p className="text-gray-600 text-center mb-8">AI 튜터 기반 영어 학습 플랫폼</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user1@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoggingIn ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <div className="mt-6 text-sm text-gray-600">
            <p className="font-semibold mb-2">테스트 계정:</p>
            <ul className="space-y-1">
              <li>• user1@example.com (프리미엄 멤버십)</li>
              <li>• user2@example.com (만료된 멤버십)</li>
              <li>• user3@example.com (멤버십 없음)</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  const activeMemberships = memberships?.filter((m) => m.is_active) || []
  const hasActiveMembership = activeMemberships.length > 0

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">AI 영어튜터</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-700">{user.name}</span>
            <button
              onClick={logout}
              className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              로그아웃
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">안녕하세요, {user.name}님!</h2>
          <p className="text-gray-600">AI와 함께 영어 실력을 향상시켜보세요.</p>
        </div>

        {/* Membership Status */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-xl font-semibold mb-4">멤버십 상태</h3>

          {membershipsLoading ? (
            <div className="text-gray-600">로딩 중...</div>
          ) : hasActiveMembership ? (
            <div className="space-y-4">
              {activeMemberships.map((membership) => (
                <div
                  key={membership.id}
                  className="border border-green-200 bg-green-50 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-semibold text-lg">
                        {membership.membership_type.name}
                      </h4>
                      <p className="text-sm text-gray-600">
                        기능: {membership.membership_type.features.join(', ')}
                      </p>
                    </div>
                    <span className="px-3 py-1 bg-green-600 text-white text-sm rounded-full">
                      활성
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    만료일: {new Date(membership.valid_to).toLocaleDateString('ko-KR')}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">활성화된 멤버십이 없습니다.</p>
              <Link
                to="/memberships"
                className="inline-block px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                멤버십 구매하기
              </Link>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => navigate('/conversation')}
            disabled={!hasActiveMembership}
            className="bg-white rounded-lg shadow p-6 text-left hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <h3 className="text-xl font-semibold mb-2">AI와 대화하기</h3>
            <p className="text-gray-600">
              {hasActiveMembership
                ? '실시간으로 AI 튜터와 영어 대화를 시작하세요.'
                : '멤버십이 필요합니다.'}
            </p>
          </button>

          <Link
            to="/memberships"
            className="block bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
          >
            <h3 className="text-xl font-semibold mb-2">멤버십 관리</h3>
            <p className="text-gray-600">멤버십 플랜을 확인하고 구매하세요.</p>
          </Link>
        </div>

        {/* Available Membership Types */}
        {!hasActiveMembership && membershipTypes && (
          <div className="mt-8">
            <h3 className="text-2xl font-bold mb-4">멤버십 플랜</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {membershipTypes.map((type) => (
                <div
                  key={type.id}
                  className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
                >
                  <h4 className="text-xl font-semibold mb-2">{type.name}</h4>
                  <p className="text-3xl font-bold text-blue-600 mb-4">
                    ₩{type.price.toLocaleString()}
                    <span className="text-sm text-gray-600 font-normal">
                      /{type.duration_days}일
                    </span>
                  </p>
                  <ul className="space-y-2 mb-6">
                    {type.features.map((feature) => (
                      <li key={feature} className="flex items-center text-gray-700">
                        <svg
                          className="w-5 h-5 text-green-500 mr-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/memberships"
                    className="block w-full text-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    선택하기
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
