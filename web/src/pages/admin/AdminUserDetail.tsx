import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../api/client'

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>()
  const userId = parseInt(id!)
  const queryClient = useQueryClient()
  const [isGrantModalOpen, setIsGrantModalOpen] = useState(false)

  const { data: user, isLoading } = useQuery({
    queryKey: ['admin', 'users', userId],
    queryFn: () => apiClient.adminGetUser(userId),
  })

  const revokeMutation = useMutation({
    mutationFn: (membershipId: number) =>
      apiClient.adminRevokeMembership(userId, membershipId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', userId] })
    },
  })

  const handleRevoke = async (membershipId: number) => {
    if (confirm('정말 멤버십을 취소하시겠습니까?')) {
      await revokeMutation.mutateAsync(membershipId)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">로딩 중...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">사용자를 찾을 수 없습니다.</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">사용자 상세</h1>
          <Link
            to="/admin/users"
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
          >
            목록으로 돌아가기
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">사용자 정보</h2>
          <dl className="grid grid-cols-1 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">ID</dt>
              <dd className="mt-1 text-sm text-gray-900">{user.id}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">이메일</dt>
              <dd className="mt-1 text-sm text-gray-900">{user.email}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">이름</dt>
              <dd className="mt-1 text-sm text-gray-900">{user.name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">멤버십 상태</dt>
              <dd className="mt-1">
                {user.has_active_membership ? (
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                    활성
                  </span>
                ) : (
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                    없음
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">멤버십 목록</h2>
            <button
              onClick={() => setIsGrantModalOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              멤버십 부여
            </button>
          </div>

          {user.memberships && user.memberships.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      멤버십 유형
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      기능
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      시작일
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      만료일
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      상태
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {user.memberships.map((membership) => (
                    <tr key={membership.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {membership.membership_type.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {membership.membership_type.features.join(', ')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(membership.valid_from).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(membership.valid_to).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {membership.is_active ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            활성
                          </span>
                        ) : (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                            {membership.status}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {membership.is_active && (
                          <button
                            onClick={() => handleRevoke(membership.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            취소
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">멤버십이 없습니다.</p>
          )}
        </div>

        {isGrantModalOpen && (
          <GrantMembershipModal
            userId={userId}
            onClose={() => setIsGrantModalOpen(false)}
          />
        )}
      </div>
    </div>
  )
}

function GrantMembershipModal({
  userId,
  onClose,
}: {
  userId: number
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null)

  const { data: membershipTypes } = useQuery({
    queryKey: ['admin', 'membershipTypes'],
    queryFn: () => apiClient.adminGetMembershipTypes(),
  })

  const grantMutation = useMutation({
    mutationFn: (membershipTypeId: number) =>
      apiClient.adminGrantMembership(userId, membershipTypeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', userId] })
      onClose()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedTypeId) {
      grantMutation.mutate(selectedTypeId)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold mb-6">멤버십 부여</h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              멤버십 유형 선택
            </label>
            <select
              value={selectedTypeId || ''}
              onChange={(e) => setSelectedTypeId(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            >
              <option value="">선택하세요</option>
              {membershipTypes?.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name} - {type.features.join(', ')} - ₩
                  {type.price.toLocaleString()}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={grantMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {grantMutation.isPending ? '부여 중...' : '부여'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
