class User < ApplicationRecord
  has_many :user_memberships, dependent: :destroy
  has_many :membership_types, through: :user_memberships

  validates :email, presence: true, uniqueness: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :name, presence: true

  def active_memberships
    user_memberships.active
  end

  def has_active_membership?
    active_memberships.exists?
  end

  def has_feature?(feature)
    active_memberships.joins(:membership_type).any? do |membership|
      membership.membership_type.has_feature?(feature)
    end
  end
end
