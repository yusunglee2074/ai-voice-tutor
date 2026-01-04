import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../test/test-utils'
import HomePage from './HomePage'
import * as authHook from '../hooks/useAuth'
import { apiClient } from '../api/client'

vi.mock('../api/client', () => ({
  apiClient: {
    getUserMemberships: vi.fn(),
    getMembershipTypes: vi.fn(),
    login: vi.fn(),
  },
}))

vi.mock('../hooks/useAuth', async () => {
  const actual = await vi.importActual('../hooks/useAuth')
  return {
    ...actual,
    useAuth: vi.fn(),
  }
})

describe('HomePage', () => {
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

    it('renders login form', async () => {
      render(<HomePage />)

      await waitFor(() => {
        expect(screen.getByText('Ringle')).toBeInTheDocument()
      })
      expect(screen.getByText('AI 튜터 기반 영어 학습 플랫폼')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('user1@example.com')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '로그인' })).toBeInTheDocument()
    })

    it('shows test account information', () => {
      render(<HomePage />)

      expect(screen.getByText('테스트 계정:')).toBeInTheDocument()
      expect(screen.getByText(/user1@example.com/)).toBeInTheDocument()
      expect(screen.getByText(/user2@example.com/)).toBeInTheDocument()
      expect(screen.getByText(/user3@example.com/)).toBeInTheDocument()
    })

    it('calls login when form is submitted', async () => {
      const mockLogin = vi.fn()
      vi.mocked(authHook.useAuth).mockReturnValue({
        user: null,
        login: mockLogin,
        logout: vi.fn(),
        isLoading: false,
      })
      vi.mocked(apiClient.getMembershipTypes).mockResolvedValue([])

      render(<HomePage />)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('user1@example.com')).toBeInTheDocument()
      })

      const emailInput = screen.getByPlaceholderText('user1@example.com')
      const submitButton = screen.getByRole('button', { name: '로그인' })

      await userEvent.clear(emailInput)
      await userEvent.type(emailInput, 'test@example.com')
      await userEvent.click(submitButton)

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test@example.com')
      })
    })
  })

  describe('when user is logged in', () => {
    const mockUser = {
      id: 1,
      email: 'user1@example.com',
      name: 'Test User',
      has_active_membership: true,
    }

    beforeEach(() => {
      vi.mocked(authHook.useAuth).mockReturnValue({
        user: mockUser,
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
      })
    })

    it('renders user greeting', async () => {
      vi.mocked(apiClient.getUserMemberships).mockResolvedValue([])
      vi.mocked(apiClient.getMembershipTypes).mockResolvedValue([])

      render(<HomePage />)

      expect(screen.getByText(`안녕하세요, ${mockUser.name}님!`)).toBeInTheDocument()
    })

    it('shows logout button', async () => {
      vi.mocked(apiClient.getUserMemberships).mockResolvedValue([])
      vi.mocked(apiClient.getMembershipTypes).mockResolvedValue([])

      render(<HomePage />)

      expect(screen.getByRole('button', { name: '로그아웃' })).toBeInTheDocument()
    })

    it('displays active membership when user has one', async () => {
      const mockMemberships = [
        {
          id: 1,
          membership_type: {
            id: 1,
            name: 'Premium',
            features: ['대화', '학습'],
          },
          valid_from: '2024-01-01',
          valid_to: '2025-12-31',
          status: 'active',
          is_active: true,
        },
      ]

      vi.mocked(apiClient.getUserMemberships).mockResolvedValue(mockMemberships)
      vi.mocked(apiClient.getMembershipTypes).mockResolvedValue([])

      render(<HomePage />)

      await waitFor(() => {
        expect(screen.getByText('Premium')).toBeInTheDocument()
      })
      expect(screen.getByText('활성')).toBeInTheDocument()
    })

    it('shows membership purchase prompt when no active membership', async () => {
      vi.mocked(apiClient.getUserMemberships).mockResolvedValue([])
      vi.mocked(apiClient.getMembershipTypes).mockResolvedValue([])

      render(<HomePage />)

      await waitFor(() => {
        expect(screen.getByText('활성화된 멤버십이 없습니다.')).toBeInTheDocument()
      })
      expect(screen.getByRole('link', { name: '멤버십 구매하기' })).toBeInTheDocument()
    })

    it('disables conversation button when no active membership', async () => {
      vi.mocked(apiClient.getUserMemberships).mockResolvedValue([])
      vi.mocked(apiClient.getMembershipTypes).mockResolvedValue([])

      render(<HomePage />)

      await waitFor(() => {
        const conversationButton = screen.getByRole('button', { name: /AI와 대화하기/i })
        expect(conversationButton).toBeDisabled()
      })
    })

    it('enables conversation button when user has active membership', async () => {
      const mockMemberships = [
        {
          id: 1,
          membership_type: {
            id: 1,
            name: 'Premium',
            features: ['대화'],
          },
          valid_from: '2024-01-01',
          valid_to: '2025-12-31',
          status: 'active',
          is_active: true,
        },
      ]

      vi.mocked(apiClient.getUserMemberships).mockResolvedValue(mockMemberships)
      vi.mocked(apiClient.getMembershipTypes).mockResolvedValue([])

      render(<HomePage />)

      await waitFor(() => {
        const conversationButton = screen.getByRole('button', { name: /AI와 대화하기/i })
        expect(conversationButton).not.toBeDisabled()
      })
    })
  })

  describe('when auth is loading', () => {
    it('shows loading state', () => {
      vi.mocked(authHook.useAuth).mockReturnValue({
        user: null,
        login: vi.fn(),
        logout: vi.fn(),
        isLoading: true,
      })

      render(<HomePage />)

      expect(screen.getByText('로딩 중...')).toBeInTheDocument()
    })
  })
})
