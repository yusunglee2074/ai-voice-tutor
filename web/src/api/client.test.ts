import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from './client'

describe('ApiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  describe('getMembershipTypes', () => {
    it('fetches membership types from correct endpoint', async () => {
      const mockTypes = [{ id: 1, name: 'Basic', features: ['학습'], duration_days: 30, price: 29000 }]
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTypes),
      } as Response)

      const result = await apiClient.getMembershipTypes()

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/membership_types'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      )
      expect(result).toEqual(mockTypes)
    })
  })

  describe('login', () => {
    it('sends POST request with email', async () => {
      const mockUser = { user: { id: 1, email: 'test@example.com', name: 'Test', has_active_membership: false } }
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUser),
      } as Response)

      const result = await apiClient.login('test@example.com')

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/sessions'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'test@example.com' }),
        })
      )
      expect(result).toEqual(mockUser)
    })
  })

  describe('getUserMemberships', () => {
    it('fetches user memberships from correct endpoint', async () => {
      const mockMemberships = [{ id: 1, status: 'active', is_active: true }]
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockMemberships),
      } as Response)

      const result = await apiClient.getUserMemberships(1)

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/users/1/memberships'),
        expect.any(Object)
      )
      expect(result).toEqual(mockMemberships)
    })
  })

  describe('adminGetUsers', () => {
    it('fetches users with query params', async () => {
      const mockResponse = { users: [], meta: { total: 0, page: 1, per_page: 20, total_pages: 0 } }
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response)

      await apiClient.adminGetUsers({ q: 'test', page: 2, per_page: 10 })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/admin\/users\?.*q=test/),
        expect.any(Object)
      )
    })
  })

  describe('adminCreateMembershipType', () => {
    it('sends POST request with membership type data', async () => {
      const newType = { name: 'New', features: ['학습'], duration_days: 30, price: 10000 }
      const mockResponse = { id: 1, ...newType }
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response)

      const result = await apiClient.adminCreateMembershipType(newType)

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/admin/membership_types'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ membership_type: newType }),
        })
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('adminGrantMembership', () => {
    it('sends POST request to grant membership', async () => {
      const mockMembership = { id: 1, status: 'active' }
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockMembership),
      } as Response)

      const result = await apiClient.adminGrantMembership(1, 2)

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/admin/users/1/memberships'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ membership_type_id: 2 }),
        })
      )
      expect(result).toEqual(mockMembership)
    })
  })

  describe('error handling', () => {
    it('throws error when response is not ok', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not found' }),
      } as Response)

      await expect(apiClient.getMembershipTypes()).rejects.toThrow('Not found')
    })

    it('throws generic error when no error message in response', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('Parse error')),
      } as Response)

      await expect(apiClient.getMembershipTypes()).rejects.toThrow()
    })
  })
})
