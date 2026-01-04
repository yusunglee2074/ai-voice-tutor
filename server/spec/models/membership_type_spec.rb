require 'rails_helper'

RSpec.describe MembershipType, type: :model do
  describe 'associations' do
    it { should have_many(:user_memberships).dependent(:restrict_with_error) }
    it { should have_many(:users).through(:user_memberships) }
  end

  describe 'validations' do
    it { should validate_presence_of(:name) }
    it { should validate_presence_of(:duration_days) }
    it { should validate_presence_of(:price) }
    it { should validate_numericality_of(:duration_days).is_greater_than(0) }
    it { should validate_numericality_of(:price).is_greater_than_or_equal_to(0) }
  end

  describe '#features_list' do
    let(:membership_type) { create(:membership_type, features: [ '대화', '학습' ].to_json) }

    it 'returns parsed features array' do
      expect(membership_type.features_list).to eq([ '대화', '학습' ])
    end

    context 'with invalid JSON' do
      before do
        membership_type.update_column(:features, 'invalid json')
      end

      it 'returns empty array' do
        expect(membership_type.features_list).to eq([])
      end
    end
  end

  describe '#features_list=' do
    let(:membership_type) { create(:membership_type) }

    it 'sets features as JSON' do
      membership_type.features_list = [ '대화', '분석' ]
      expect(membership_type.features).to eq([ '대화', '분석' ].to_json)
    end
  end

  describe '#has_feature?' do
    let(:membership_type) { create(:membership_type, features: [ '대화', '학습' ].to_json) }

    it 'returns true for included features' do
      expect(membership_type.has_feature?('대화')).to be true
    end

    it 'returns false for non-included features' do
      expect(membership_type.has_feature?('분석')).to be false
    end
  end

  describe 'feature validation' do
    it 'accepts valid features' do
      membership_type = build(:membership_type, features: [ '대화', '학습', '분석' ].to_json)
      expect(membership_type).to be_valid
    end

    it 'rejects invalid features' do
      membership_type = build(:membership_type, features: [ 'invalid', '대화' ].to_json)
      expect(membership_type).not_to be_valid
      expect(membership_type.errors[:features]).to include(/contains invalid features/)
    end
  end
end
