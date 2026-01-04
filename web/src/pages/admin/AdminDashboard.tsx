import { Link } from 'react-router-dom'

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">관리자 대시보드</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            to="/admin/membership-types"
            className="block p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow"
          >
            <h2 className="text-xl font-semibold mb-2">멤버십 유형 관리</h2>
            <p className="text-gray-600">멤버십 유형 생성, 수정, 삭제</p>
          </Link>

          <Link
            to="/admin/users"
            className="block p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow"
          >
            <h2 className="text-xl font-semibold mb-2">사용자 관리</h2>
            <p className="text-gray-600">사용자 조회 및 멤버십 부여</p>
          </Link>
        </div>
      </div>
    </div>
  )
}
