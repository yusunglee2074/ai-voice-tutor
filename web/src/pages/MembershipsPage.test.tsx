import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { render } from '../test/test-utils'
import MembershipsPage from './MembershipsPage'
import * as authHook from '../hooks/useAuth'
import { apiClient } from '../api/client'

vi.mock('../api/client', () => ({
  apiClient: {
    getUserMemberships: vi.fn(),
    getMembershipTypes: vi.fn(),
  },
}))

vi.mock('../hooks/useAuth', async () => {
  const actual = await vi.importActual('../hooks/useAuth')
  return {
    ...actual,
    useAuth: vi.fn(),
  }
})

describe('MembershipsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('when user is not logged in', () => {
    beforeEach(() => {
      vi.mocked(authHook.useAuth).mockReturnValue({
        user: null,
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
      })
      vi.mocked(apiClient.getMembershipTypes).mockResolvedValue([])
    })

    it('shows login required message', async () => {
      render(<MembershipsPage />)

      await waitFor(() => {
        expect(screen.getByText('로그인이 필요합니다.')).toBeInTheDocument()
      })
      expect(screen.getByRole('link', { name: '로그인하기' })).toBeInTheDocument()
    })
  })

  describe('when user is logged in', () => {
    const mockUser = {
      id: 1,
      email: 'user1@example.com',
      name: 'Test User',
      has_active_membership: true,
    }

    const mockMembershipTypes = [
      {
        id: 1,
        name: 'Basic',
        features: ['학습'],
        duration_days: 30,
        price: 29000,
      },
      {
        id: 2,
        name: 'Premium',
        features: ['학습', '대화'],
        duration_days: 30,
        price: 59000,
      },
      {
        id: 3,
        name: 'Pro',
        features: ['학습', '대화', '분석'],
        duration_days: 30,
        price: 99000,
      },
    ]

    beforeEach(() => {
      vi.mocked(authHook.useAuth).mockReturnValue({
        user: mockUser,
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
      })
      vi.mocked(apiClient.getMembershipTypes).mockResolvedValue(mockMembershipTypes)
    })

    it('renders page title', async () => {
      vi.mocked(apiClient.getUserMemberships).mockResolvedValue([])

      render(<MembershipsPage />)

      await waitFor(() => {
        expect(screen.getByText('멤버십 플랜')).toBeInTheDocument()
      })
    })

    it('displays all membership types', async () => {
      vi.mocked(apiClient.getUserMemberships).mockResolvedValue([])

      render(<MembershipsPage />)

      await waitFor(() => {
        expect(screen.getByText('Basic')).toBeInTheDocument()
        expect(screen.getByText('Premium')).toBeInTheDocument()
        expect(screen.getByText('Pro')).toBeInTheDocument()
      })
    })

    it('displays membership prices', async () => {
      vi.mocked(apiClient.getUserMemberships).mockResolvedValue([])

      render(<MembershipsPage />)

      await waitFor(() => {
        expect(screen.getByText('₩29,000')).toBeInTheDocument()
        expect(screen.getByText('₩59,000')).toBeInTheDocument()
        expect(screen.getByText('₩99,000')).toBeInTheDocument()
      })
    })

    it('displays current active membership', async () => {
      const mockMemberships = [
        {
          id: 1,
          membership_type: {
            id: 2,
            name: 'Premium',
            features: ['학습', '대화'],
          },
          valid_from: '2024-01-01',
          valid_to: '2025-12-31',
          status: 'active',
          is_active: true,
        },
      ]

      vi.mocked(apiClient.getUserMemberships).mockResolvedValue(mockMemberships)

      render(<MembershipsPage />)

      await waitFor(() => {
        expect(screen.getByText('현재 멤버십')).toBeInTheDocument()
      })

      const activeBadges = screen.getAllByText('활성')
      expect(activeBadges.length).toBeGreaterThan(0)
    })

    it('shows info section with guidance', async () => {
      vi.mocked(apiClient.getUserMemberships).mockResolvedValue([])

      render(<MembershipsPage />)

      await waitFor(() => {
        expect(screen.getByText('💡 안내사항')).toBeInTheDocument()
        expect(screen.getByText(/실제 결제 기능은 구현되지 않았습니다/)).toBeInTheDocument()
      })
    })

    it('has link to admin page', async () => {
      vi.mocked(apiClient.getUserMemberships).mockResolvedValue([])

      render(<MembershipsPage />)

      await waitFor(() => {
        expect(screen.getByRole('link', { name: '관리자 페이지로 이동' })).toBeInTheDocument()
      })
    })

    it('displays features for each membership type', async () => {
      vi.mocked(apiClient.getUserMemberships).mockResolvedValue([])

      render(<MembershipsPage />)

      await waitFor(() => {
        expect(screen.getAllByText('학습').length).toBeGreaterThan(0)
        expect(screen.getAllByText('대화').length).toBeGreaterThan(0)
        expect(screen.getAllByText('분석').length).toBeGreaterThan(0)
      })
    })
  })

  describe('when loading', () => {
    it('shows loading state', () => {
      vi.mocked(authHook.useAuth).mockReturnValue({
        user: null,
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: true,
      })

      render(<MembershipsPage />)

      expect(screen.getByText('로딩 중...')).toBeInTheDocument()
    })
  })
})
