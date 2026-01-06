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

}

export const apiClient = new ApiClient(API_BASE_URL);
