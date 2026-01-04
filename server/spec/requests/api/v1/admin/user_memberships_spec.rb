require 'rails_helper'

RSpec.describe "Api::V1::Admin::UserMemberships", type: :request do
  let!(:user) { create(:user) }
  let!(:membership_type) { create(:membership_type) }
  let!(:user_membership) { create(:user_membership, user: user, membership_type: membership_type) }

  describe "GET /api/v1/admin/users/:user_id/memberships" do
    it "returns user's memberships" do
      get "/api/v1/admin/users/#{user.id}/memberships"

      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)
      expect(json).to be_an(Array)
      expect(json.first['id']).to eq(user_membership.id)
      expect(json.first['membership_type']['name']).to eq(membership_type.name)
    end
  end

  describe "POST /api/v1/admin/users/:user_id/memberships" do
    let(:new_membership_type) { create(:membership_type, name: 'New Type') }

    it "grants membership to user" do
      expect {
        post "/api/v1/admin/users/#{user.id}/memberships",
          params: { membership_type_id: new_membership_type.id }
      }.to change(user.user_memberships, :count).by(1)

      expect(response).to have_http_status(:created)
      json = JSON.parse(response.body)
      expect(json['membership_type']['name']).to eq('New Type')
      expect(json['status']).to eq('active')
    end
  end

  describe "DELETE /api/v1/admin/users/:user_id/memberships/:id" do
    it "cancels user membership" do
      delete "/api/v1/admin/users/#{user.id}/memberships/#{user_membership.id}"

      expect(response).to have_http_status(:no_content)
      expect(user_membership.reload.status).to eq('cancelled')
    end
  end
end
