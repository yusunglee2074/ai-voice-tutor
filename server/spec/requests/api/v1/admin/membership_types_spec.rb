require 'rails_helper'

RSpec.describe "Api::V1::Admin::MembershipTypes", type: :request do
  let!(:membership_type) { create(:membership_type, name: 'Premium', features: ['대화', '학습'].to_json) }

  describe "GET /api/v1/admin/membership_types" do
    it "returns all membership types" do
      get "/api/v1/admin/membership_types"

      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)
      expect(json).to be_an(Array)
      expect(json.first['name']).to eq('Premium')
    end
  end

  describe "GET /api/v1/admin/membership_types/:id" do
    it "returns a specific membership type" do
      get "/api/v1/admin/membership_types/#{membership_type.id}"

      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)
      expect(json['id']).to eq(membership_type.id)
      expect(json['name']).to eq('Premium')
      expect(json['features']).to eq(['대화', '학습'])
    end
  end

  describe "POST /api/v1/admin/membership_types" do
    let(:valid_params) do
      {
        membership_type: {
          name: 'Basic',
          features: ['대화'],
          duration_days: 30,
          price: 29000
        }
      }
    end

    it "creates a new membership type" do
      expect {
        post "/api/v1/admin/membership_types", params: valid_params
      }.to change(MembershipType, :count).by(1)

      expect(response).to have_http_status(:created)
      json = JSON.parse(response.body)
      expect(json['name']).to eq('Basic')
      expect(json['features']).to eq(['대화'])
    end

    it "returns error for invalid params" do
      post "/api/v1/admin/membership_types", params: { membership_type: { name: '' } }

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "PUT /api/v1/admin/membership_types/:id" do
    let(:update_params) do
      {
        membership_type: {
          name: 'Updated Premium',
          features: ['대화', '학습', '분석'],
          duration_days: 60,
          price: 99000
        }
      }
    end

    it "updates the membership type" do
      put "/api/v1/admin/membership_types/#{membership_type.id}", params: update_params

      expect(response).to have_http_status(:success)
      json = JSON.parse(response.body)
      expect(json['name']).to eq('Updated Premium')
      expect(json['features']).to eq(['대화', '학습', '분석'])
    end
  end

  describe "DELETE /api/v1/admin/membership_types/:id" do
    it "deletes the membership type" do
      expect {
        delete "/api/v1/admin/membership_types/#{membership_type.id}"
      }.to change(MembershipType, :count).by(-1)

      expect(response).to have_http_status(:no_content)
    end
  end
end
