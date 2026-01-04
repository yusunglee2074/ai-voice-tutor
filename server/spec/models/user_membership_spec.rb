require 'rails_helper'

RSpec.describe UserMembership, type: :model do
  describe 'associations' do
    it { should belong_to(:user) }
    it { should belong_to(:membership_type) }
  end

  describe 'validations' do
    it { should validate_presence_of(:valid_from) }
    it { should validate_presence_of(:valid_to) }
    it { should validate_presence_of(:status) }
    it { should validate_inclusion_of(:status).in_array(%w[active expired cancelled]) }
  end

  describe 'valid_to_after_valid_from validation' do
    let(:user) { create(:user) }
    let(:membership_type) { create(:membership_type) }

    it 'is invalid when valid_to is before valid_from' do
      membership = build(:user_membership,
        user: user,
        membership_type: membership_type,
        valid_from: Time.current,
        valid_to: 1.day.ago
      )
      expect(membership).not_to be_valid
      expect(membership.errors[:valid_to]).to include('must be after valid_from')
    end
  end

  describe 'scopes' do
    let(:user) { create(:user) }
    let(:membership_type) { create(:membership_type) }

    describe '.active' do
      it 'returns only active and non-expired memberships' do
        active = create(:user_membership, user: user, membership_type: membership_type)
        expired = create(:user_membership, :expired, user: user, membership_type: membership_type)
        cancelled = create(:user_membership, :cancelled, user: user, membership_type: membership_type)

        expect(UserMembership.active).to include(active)
        expect(UserMembership.active).not_to include(expired)
        expect(UserMembership.active).not_to include(cancelled)
      end
    end

    describe '.expired' do
      it 'returns expired memberships' do
        active = create(:user_membership, user: user, membership_type: membership_type)
        expired = create(:user_membership, :expired, user: user, membership_type: membership_type)

        expect(UserMembership.expired).to include(expired)
        expect(UserMembership.expired).not_to include(active)
      end
    end
  end

  describe '#expired?' do
    let(:membership) { create(:user_membership) }

    context 'when valid_to is in the past' do
      before { membership.update_column(:valid_to, 1.day.ago) }

      it 'returns true' do
        expect(membership.expired?).to be true
      end
    end

    context 'when status is expired' do
      before { membership.update_column(:status, 'expired') }

      it 'returns true' do
        expect(membership.expired?).to be true
      end
    end

    context 'when active and not expired' do
      it 'returns false' do
        expect(membership.expired?).to be false
      end
    end
  end

  describe '#active?' do
    let(:membership) { create(:user_membership) }

    context 'when status is active and not expired' do
      it 'returns true' do
        expect(membership.active?).to be true
      end
    end

    context 'when expired' do
      before { membership.update_column(:valid_to, 1.day.ago) }

      it 'returns false' do
        expect(membership.active?).to be false
      end
    end
  end

  describe '#cancel!' do
    let(:membership) { create(:user_membership) }

    it 'sets status to cancelled' do
      membership.cancel!
      expect(membership.status).to eq('cancelled')
    end
  end

  describe '.expire_memberships!' do
    let(:user) { create(:user) }
    let(:membership_type) { create(:membership_type) }

    it 'expires memberships past their valid_to date' do
      # Create a valid membership first, then update valid_to directly in DB to bypass validation
      expired_membership = create(:user_membership,
        user: user,
        membership_type: membership_type
      )
      expired_membership.update_column(:valid_to, 1.day.ago)

      UserMembership.expire_memberships!
      expect(expired_membership.reload.status).to eq('expired')
    end

    it 'does not affect future memberships' do
      active_membership = create(:user_membership, user: user, membership_type: membership_type)

      UserMembership.expire_memberships!
      expect(active_membership.reload.status).to eq('active')
    end
  end

  describe 'before_save callback' do
    let(:user) { create(:user) }
    let(:membership_type) { create(:membership_type) }

    it 'automatically expires membership on save if past valid_to' do
      # Create membership with valid_from in the past so we can set valid_to to yesterday
      membership = create(:user_membership,
        user: user,
        membership_type: membership_type,
        valid_from: 10.days.ago,
        valid_to: 5.days.from_now
      )
      # Now update to a past date (still after valid_from)
      membership.valid_to = 1.day.ago
      membership.save!
      expect(membership.status).to eq('expired')
    end
  end
end
