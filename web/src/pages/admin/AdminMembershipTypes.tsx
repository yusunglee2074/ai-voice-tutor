import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient, type MembershipType } from '../../api/client'

export default function AdminMembershipTypes() {
  const queryClient = useQueryClient()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingType, setEditingType] = useState<MembershipType | null>(null)

  const { data: membershipTypes, isLoading } = useQuery({
    queryKey: ['admin', 'membershipTypes'],
    queryFn: () => apiClient.adminGetMembershipTypes(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.adminDeleteMembershipType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'membershipTypes'] })
    },
  })

  const handleDelete = async (id: number) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      await deleteMutation.mutateAsync(id)
    }
  }

  const handleEdit = (type: MembershipType) => {
    setEditingType(type)
    setIsModalOpen(true)
  }

  const handleCreate = () => {
    setEditingType(null)
    setIsModalOpen(true)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">멤버십 유형 관리</h1>
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            새 멤버십 유형 추가
          </button>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  이름
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  기능
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  유효기간
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  가격
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {membershipTypes?.map((type) => (
                <tr key={type.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {type.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {type.features.join(', ')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {type.duration_days}일
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ₩{type.price.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(type)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(type.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isModalOpen && (
          <MembershipTypeModal
            membershipType={editingType}
            onClose={() => setIsModalOpen(false)}
          />
        )}
      </div>
    </div>
  )
}

function MembershipTypeModal({
  membershipType,
  onClose,
}: {
  membershipType: MembershipType | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({
    name: membershipType?.name || '',
    features: membershipType?.features || [],
    duration_days: membershipType?.duration_days || 30,
    price: membershipType?.price || 0,
  })

  const availableFeatures = ['학습', '대화', '분석']

  const mutation = useMutation({
    mutationFn: (data: typeof formData) => {
      if (membershipType) {
        return apiClient.adminUpdateMembershipType(membershipType.id, data)
      } else {
        return apiClient.adminCreateMembershipType(data)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'membershipTypes'] })
      onClose()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate(formData)
  }

  const toggleFeature = (feature: string) => {
    setFormData((prev) => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter((f) => f !== feature)
        : [...prev.features, feature],
    }))
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold mb-6">
          {membershipType ? '멤버십 유형 수정' : '새 멤버십 유형 추가'}
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              이름
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              기능
            </label>
            <div className="space-y-2">
              {availableFeatures.map((feature) => (
                <label key={feature} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.features.includes(feature)}
                    onChange={() => toggleFeature(feature)}
                    className="mr-2"
                  />
                  {feature}
                </label>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              유효기간 (일)
            </label>
            <input
              type="number"
              value={formData.duration_days}
              onChange={(e) =>
                setFormData({ ...formData, duration_days: parseInt(e.target.value) })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              가격 (원)
            </label>
            <input
              type="number"
              value={formData.price}
              onChange={(e) =>
                setFormData({ ...formData, price: parseFloat(e.target.value) })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
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
              disabled={mutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {mutation.isPending ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
