class UserMembership < ApplicationRecord
  STATUSES = %w[active expired cancelled].freeze

  belongs_to :user
  belongs_to :membership_type

  validates :valid_from, presence: true
  validates :valid_to, presence: true
  validates :status, presence: true, inclusion: { in: STATUSES }
  validate :valid_to_after_valid_from

  scope :active, -> { where(status: "active").where("valid_to > ?", Time.current) }
  scope :expired, -> { where(status: "expired").or(where("valid_to <= ?", Time.current)) }

  before_save :check_expiration

  def expired?
    valid_to <= Time.current || status == "expired"
  end

  def active?
    status == "active" && valid_to > Time.current
  end

  def cancel!
    update!(status: "cancelled")
  end

  def self.expire_memberships!
    where(status: "active")
      .where("valid_to <= ?", Time.current)
      .update_all(status: "expired")
  end

  private

  def valid_to_after_valid_from
    return if valid_from.blank? || valid_to.blank?

    if valid_to <= valid_from
      errors.add(:valid_to, "must be after valid_from")
    end
  end

  def check_expiration
    if status == "active" && valid_to <= Time.current
      self.status = "expired"
    end
  end
end
