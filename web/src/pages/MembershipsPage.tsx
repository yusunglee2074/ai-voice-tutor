import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { apiClient } from '../api/client'

export default function MembershipsPage() {
  const { user, isLoading: authLoading } = useAuth()

  const { data: membershipTypes, isLoading: typesLoading } = useQuery({
    queryKey: ['membershipTypes'],
    queryFn: () => apiClient.getMembershipTypes(),
  })

  const { data: userMemberships, isLoading: membershipsLoading } = useQuery({
    queryKey: ['userMemberships', user?.id],
    queryFn: () => apiClient.getUserMemberships(user!.id),
    enabled: !!user,
  })

  if (authLoading || typesLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">로딩 중...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">로그인이 필요합니다.</p>
          <Link
            to="/"
            className="inline-block px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            로그인하기
          </Link>
        </div>
      </div>
    )
  }

  const activeMemberships = userMemberships?.filter((m) => m.is_active) || []

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold text-blue-600">
            AI 영어튜터
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

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">멤버십 플랜</h1>
          <p className="text-gray-600">
            AI 튜터와 함께하는 영어 학습을 시작하세요.
          </p>
        </div>

        {/* Current Memberships */}
        {membershipsLoading ? (
          <div className="text-gray-600 mb-8">멤버십 정보 로딩 중...</div>
        ) : activeMemberships.length > 0 ? (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">현재 멤버십</h2>
            <div className="space-y-4">
              {activeMemberships.map((membership) => (
                <div
                  key={membership.id}
                  className="border border-green-200 bg-green-50 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg">
                        {membership.membership_type.name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        기능: {membership.membership_type.features.join(', ')}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        만료일:{' '}
                        {new Date(membership.valid_to).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                    <span className="px-3 py-1 bg-green-600 text-white text-sm rounded-full">
                      활성
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Available Plans */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-6">
            {activeMemberships.length > 0 ? '추가 멤버십' : '멤버십 선택'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {membershipTypes?.map((type) => (
              <div
                key={type.id}
                className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-shadow relative"
              >
                <div className="mb-6">
                  <h3 className="text-2xl font-bold mb-2">{type.name}</h3>
                  <div className="flex items-baseline">
                    <span className="text-4xl font-bold text-blue-600">
                      ₩{type.price.toLocaleString()}
                    </span>
                    <span className="text-gray-600 ml-2">
                      / {type.duration_days}일
                    </span>
                  </div>
                </div>

                <div className="mb-8">
                  <h4 className="font-semibold text-gray-900 mb-3">포함된 기능:</h4>
                  <ul className="space-y-3">
                    {type.features.map((feature) => (
                      <li key={feature} className="flex items-start">
                        <svg
                          className="w-6 h-6 text-green-500 mr-3 flex-shrink-0"
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
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() =>
                    alert('실제 결제 기능은 구현되지 않았습니다.')
                  }
                  className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  선택하기
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Info Section */}
        <div className="bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-3">💡 안내사항</h3>
          <ul className="space-y-2 text-gray-700">
            <li>• 실제 결제 기능은 구현되지 않았습니다.</li>
            <li>• 멤버십은 유효기간이 지나면 자동으로 만료됩니다.</li>
            <li>• 여러 멤버십을 동시에 보유할 수 있습니다.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
