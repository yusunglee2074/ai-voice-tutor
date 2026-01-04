require 'rails_helper'

RSpec.describe "Api::V1::Admin::Users", type: :request do
  let!(:user1) { create(:user, email: 'test1@example.com', name: 'Test User 1') }
  let!(:user2) { create(:user, email: 'test2@example.com', name: 'Test User 2') }
  let!(:membership_type) { create(:membership_type) }

  describe "GET /api/v1/admin/users" do
    it "returns all users" do
      get "/api/v1/admin/users"

      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)
      expect(json['users']).to be_an(Array)
      expect(json['users'].length).to eq(2)
      expect(json['meta']['total']).to eq(2)
    end

    it "searches users by email" do
      get "/api/v1/admin/users", params: { q: 'test1' }

      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)
      expect(json['users'].length).to eq(1)
      expect(json['users'].first['email']).to eq('test1@example.com')
    end

    it "paginates results" do
      get "/api/v1/admin/users", params: { page: 1, per_page: 1 }

      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)
      expect(json['users'].length).to eq(1)
      expect(json['meta']['per_page']).to eq(1)
      expect(json['meta']['total_pages']).to eq(2)
    end
  end

  describe "GET /api/v1/admin/users/:id" do
    before do
      create(:user_membership, user: user1, membership_type: membership_type)
    end

    it "returns user details with memberships" do
      get "/api/v1/admin/users/#{user1.id}"

      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)
      expect(json['id']).to eq(user1.id)
      expect(json['email']).to eq('test1@example.com')
      expect(json['memberships']).to be_an(Array)
      expect(json['memberships'].length).to eq(1)
    end
  end
end
