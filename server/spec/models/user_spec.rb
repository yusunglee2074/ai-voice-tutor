require 'rails_helper'

RSpec.describe User, type: :model do
  describe 'associations' do
    it { should have_many(:user_memberships).dependent(:destroy) }
    it { should have_many(:membership_types).through(:user_memberships) }
  end

  describe 'validations' do
    subject { build(:user) }

    it { should validate_presence_of(:email) }
    it { should validate_presence_of(:name) }
    it { should validate_uniqueness_of(:email) }
  end

  describe '#active_memberships' do
    let(:user) { create(:user) }
    let(:membership_type) { create(:membership_type) }

    it 'returns only active memberships' do
      active = create(:user_membership, user: user, membership_type: membership_type)
      expired = create(:user_membership, :expired, user: user, membership_type: membership_type)

      expect(user.active_memberships).to include(active)
      expect(user.active_memberships).not_to include(expired)
    end
  end

  describe '#has_active_membership?' do
    let(:user) { create(:user) }

    context 'when user has active membership' do
      before do
        create(:user_membership, user: user)
      end

      it 'returns true' do
        expect(user.has_active_membership?).to be true
      end
    end

    context 'when user has no active membership' do
      it 'returns false' do
        expect(user.has_active_membership?).to be false
      end
    end
  end

  describe '#has_feature?' do
    let(:user) { create(:user) }
    let(:membership_type) { create(:membership_type, features: [ '대화', '학습' ].to_json) }

    before do
      create(:user_membership, user: user, membership_type: membership_type)
    end

    it 'returns true for included features' do
      expect(user.has_feature?('대화')).to be true
      expect(user.has_feature?('학습')).to be true
    end

    it 'returns false for non-included features' do
      expect(user.has_feature?('분석')).to be false
    end
  end
end
