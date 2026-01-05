import { renderHook, waitFor, act } from '@testing-library/react'
import { vi } from 'vitest'
import { useAuth, AuthProvider } from './useAuth'
import { apiClient } from '../api/client'

vi.mock('../api/client', () => ({
  apiClient: {
    login: vi.fn(),
    getUser: vi.fn(),
  },
}))

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('초기 로딩 상태를 반환한다', async () => {
    // Mock auto-login to prevent errors
    vi.mocked(apiClient.login).mockResolvedValue({
      user: { id: 1, email: 'user1@example.com', name: 'User 1', has_active_membership: true }
    })

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    })

    expect(result.current.isLoading).toBe(true)

    // Wait for auto-login to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
  })

  it('localStorage에 userId가 있으면 자동 로그인한다', async () => {
    localStorage.setItem('userId', '1')
    vi.mocked(apiClient.getUser).mockResolvedValue({
      user: { id: 1, email: 'test@example.com', name: 'Test User', has_active_membership: true }
    })

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    })

    await waitFor(() => {
      expect(result.current.user).toEqual({
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        has_active_membership: true
      })
      expect(result.current.isLoading).toBe(false)
    })
  })

  it('login 함수가 사용자를 설정하고 localStorage에 저장한다', async () => {
    const mockUser = { id: 1, email: 'test@example.com', name: 'Test', has_active_membership: true }
    vi.mocked(apiClient.login).mockResolvedValue({ user: mockUser })

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    await act(async () => {
      await result.current.login('test@example.com')
    })

    expect(result.current.user).toEqual(mockUser)
    expect(localStorage.getItem('userId')).toBe('1')
  })

  it('logout 함수가 사용자를 제거하고 localStorage를 클리어한다', async () => {
    localStorage.setItem('userId', '1')
    vi.mocked(apiClient.getUser).mockResolvedValue({
      user: { id: 1, email: 'test@example.com', name: 'Test', has_active_membership: true }
    })

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    })

    await waitFor(() => {
      expect(result.current.user).toBeTruthy()
    })

    act(() => {
      result.current.logout()
    })

    expect(result.current.user).toBeNull()
    expect(localStorage.getItem('userId')).toBeNull()
  })

  it('getUser 실패 시 localStorage를 클리어한다', async () => {
    localStorage.setItem('userId', '999')
    vi.mocked(apiClient.getUser).mockRejectedValue(new Error('User not found'))

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.user).toBeNull()
    expect(localStorage.getItem('userId')).toBeNull()
  })

  it('localStorage가 비어있으면 자동 로그인을 시도한다', async () => {
    const mockUser = { id: 1, email: 'user1@example.com', name: 'User 1', has_active_membership: true }
    vi.mocked(apiClient.login).mockResolvedValue({ user: mockUser })

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(apiClient.login).toHaveBeenCalledWith('user1@example.com')
    expect(result.current.user).toEqual(mockUser)
    expect(localStorage.getItem('userId')).toBe('1')
  })

  it('자동 로그인 실패 시 에러를 무시한다', async () => {
    vi.mocked(apiClient.login).mockRejectedValue(new Error('Login failed'))

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.user).toBeNull()
    expect(localStorage.getItem('userId')).toBeNull()
  })
})
