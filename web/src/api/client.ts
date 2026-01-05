const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

export interface MembershipType {
  id: number;
  name: string;
  features: string[];
  duration_days: number;
  price: number;
}

export interface User {
  id: number;
  email: string;
  name: string;
  has_active_membership: boolean;
}

export interface UserMembership {
  id: number;
  membership_type: {
    id: number;
    name: string;
    features: string[];
  };
  valid_from: string;
  valid_to: string;
  status: string;
  is_active: boolean;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Public APIs
  async getMembershipTypes(): Promise<MembershipType[]> {
    return this.request<MembershipType[]>('/membership_types');
  }

  async getMembershipType(id: number): Promise<MembershipType> {
    return this.request<MembershipType>(`/membership_types/${id}`);
  }

  async getUserMemberships(userId: number): Promise<UserMembership[]> {
    return this.request<UserMembership[]>(`/users/${userId}/memberships`);
  }

  // Mock Auth
  async login(email: string): Promise<{ user: User }> {
    return this.request<{ user: User }>('/sessions', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async getUser(userId: number): Promise<{ user: User }> {
    return this.request<{ user: User }>(`/sessions/${userId}`);
  }

  // Admin APIs
  async adminGetMembershipTypes(): Promise<MembershipType[]> {
    return this.request<MembershipType[]>('/admin/membership_types');
  }

  async adminCreateMembershipType(data: {
    name: string;
    features: string[];
    duration_days: number;
    price: number;
  }): Promise<MembershipType> {
    return this.request<MembershipType>('/admin/membership_types', {
      method: 'POST',
      body: JSON.stringify({ membership_type: data }),
    });
  }

  async adminUpdateMembershipType(
    id: number,
    data: {
      name: string;
      features: string[];
      duration_days: number;
      price: number;
    }
  ): Promise<MembershipType> {
    return this.request<MembershipType>(`/admin/membership_types/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ membership_type: data }),
    });
  }

  async adminDeleteMembershipType(id: number): Promise<void> {
    await this.request<void>(`/admin/membership_types/${id}`, {
      method: 'DELETE',
    });
  }

  async adminGetUsers(params?: {
    q?: string;
    page?: number;
    per_page?: number;
  }): Promise<{
    users: User[];
    meta: {
      total: number;
      page: number;
      per_page: number;
      total_pages: number;
    };
  }> {
    const queryParams = new URLSearchParams();
    if (params?.q) queryParams.append('q', params.q);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.per_page) queryParams.append('per_page', params.per_page.toString());

    const query = queryParams.toString();
    return this.request(`/admin/users${query ? `?${query}` : ''}`);
  }

  async adminGetUser(userId: number): Promise<User & { memberships: UserMembership[] }> {
    return this.request(`/admin/users/${userId}`);
  }

  async adminGrantMembership(
    userId: number,
    membershipTypeId: number
  ): Promise<UserMembership> {
    return this.request<UserMembership>(`/admin/users/${userId}/memberships`, {
      method: 'POST',
      body: JSON.stringify({ membership_type_id: membershipTypeId }),
    });
  }

  async adminRevokeMembership(userId: number, membershipId: number): Promise<void> {
    await this.request<void>(`/admin/users/${userId}/memberships/${membershipId}`, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
