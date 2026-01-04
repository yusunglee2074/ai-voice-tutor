import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../../test/test-utils'
import AdminMembershipTypes from './AdminMembershipTypes'
import { apiClient } from '../../api/client'

vi.mock('../../api/client', () => ({
  apiClient: {
    adminGetMembershipTypes: vi.fn(),
    adminCreateMembershipType: vi.fn(),
    adminUpdateMembershipType: vi.fn(),
    adminDeleteMembershipType: vi.fn(),
  },
}))

describe('AdminMembershipTypes', () => {
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
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(apiClient.adminGetMembershipTypes).mockResolvedValue(mockMembershipTypes)
  })

  it('renders page title', async () => {
    render(<AdminMembershipTypes />)

    await waitFor(() => {
      expect(screen.getByText('멤버십 유형 관리')).toBeInTheDocument()
    })
  })

  it('displays membership types in table', async () => {
    render(<AdminMembershipTypes />)

    await waitFor(() => {
      expect(screen.getByText('Basic')).toBeInTheDocument()
      expect(screen.getByText('Premium')).toBeInTheDocument()
    })
  })

  it('displays membership prices formatted', async () => {
    render(<AdminMembershipTypes />)

    await waitFor(() => {
      expect(screen.getByText('₩29,000')).toBeInTheDocument()
      expect(screen.getByText('₩59,000')).toBeInTheDocument()
    })
  })

  it('displays features as text', async () => {
    render(<AdminMembershipTypes />)

    await waitFor(() => {
      expect(screen.getByText('학습')).toBeInTheDocument()
      expect(screen.getByText('학습, 대화')).toBeInTheDocument()
    })
  })

  it('has create new button', async () => {
    render(<AdminMembershipTypes />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '새 멤버십 유형 추가' })).toBeInTheDocument()
    })
  })

  it('opens modal when create button is clicked', async () => {
    render(<AdminMembershipTypes />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '새 멤버십 유형 추가' })).toBeInTheDocument()
    })

    const createButton = screen.getByRole('button', { name: '새 멤버십 유형 추가' })
    await userEvent.click(createButton)

    await waitFor(() => {
      // The modal shows the same text as the button for create mode
      const modalTitles = screen.getAllByText('새 멤버십 유형 추가')
      expect(modalTitles.length).toBeGreaterThan(1)
    })
  })

  it('has edit buttons for each membership type', async () => {
    render(<AdminMembershipTypes />)

    await waitFor(() => {
      const editButtons = screen.getAllByRole('button', { name: '수정' })
      expect(editButtons.length).toBe(2)
    })
  })

  it('has delete buttons for each membership type', async () => {
    render(<AdminMembershipTypes />)

    await waitFor(() => {
      const deleteButtons = screen.getAllByRole('button', { name: '삭제' })
      expect(deleteButtons.length).toBe(2)
    })
  })

  it('shows loading state initially', () => {
    vi.mocked(apiClient.adminGetMembershipTypes).mockImplementation(
      () => new Promise(() => {})
    )

    render(<AdminMembershipTypes />)

    expect(screen.getByText('로딩 중...')).toBeInTheDocument()
  })

})
