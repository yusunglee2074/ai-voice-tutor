import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../../test/test-utils'
import AdminUsers from './AdminUsers'
import { apiClient } from '../../api/client'

vi.mock('../../api/client', () => ({
  apiClient: {
    adminGetUsers: vi.fn(),
  },
}))

describe('AdminUsers', () => {
  const mockUsersResponse = {
    users: [
      {
        id: 1,
        email: 'user1@example.com',
        name: 'User One',
        has_active_membership: true,
      },
      {
        id: 2,
        email: 'user2@example.com',
        name: 'User Two',
        has_active_membership: false,
      },
    ],
    meta: {
      total: 2,
      page: 1,
      per_page: 20,
      total_pages: 1,
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(apiClient.adminGetUsers).mockResolvedValue(mockUsersResponse)
  })

  it('renders page title', async () => {
    render(<AdminUsers />)

    await waitFor(() => {
      expect(screen.getByText('사용자 관리')).toBeInTheDocument()
    })
  })

  it('displays users in table', async () => {
    render(<AdminUsers />)

    await waitFor(() => {
      expect(screen.getByText('user1@example.com')).toBeInTheDocument()
      expect(screen.getByText('user2@example.com')).toBeInTheDocument()
      expect(screen.getByText('User One')).toBeInTheDocument()
      expect(screen.getByText('User Two')).toBeInTheDocument()
    })
  })

  it('shows membership status badges', async () => {
    render(<AdminUsers />)

    await waitFor(() => {
      expect(screen.getByText('활성')).toBeInTheDocument()
      expect(screen.getByText('없음')).toBeInTheDocument()
    })
  })

  it('has search input', async () => {
    render(<AdminUsers />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('이메일 또는 이름으로 검색...')).toBeInTheDocument()
    })
  })

  it('has detail links for each user', async () => {
    render(<AdminUsers />)

    await waitFor(() => {
      const detailLinks = screen.getAllByRole('link', { name: '상세보기' })
      expect(detailLinks.length).toBe(2)
    })
  })

  it('shows loading state initially', () => {
    vi.mocked(apiClient.adminGetUsers).mockImplementation(
      () => new Promise(() => {})
    )

    render(<AdminUsers />)

    expect(screen.getByText('로딩 중...')).toBeInTheDocument()
  })

  it('has link back to admin dashboard', async () => {
    render(<AdminUsers />)

    await waitFor(() => {
      expect(screen.getByRole('link', { name: '대시보드로 돌아가기' })).toBeInTheDocument()
    })
  })
})
