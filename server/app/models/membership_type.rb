class MembershipType < ApplicationRecord
  AVAILABLE_FEATURES = %w[학습 대화 분석].freeze

  has_many :user_memberships, dependent: :restrict_with_error
  has_many :users, through: :user_memberships

  validates :name, presence: true
  validates :duration_days, presence: true, numericality: { greater_than: 0 }
  validates :price, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validate :validate_features

  def features_list
    JSON.parse(features || "[]")
  rescue JSON::ParserError
    []
  end

  def features_list=(list)
    self.features = list.to_json
  end

  def has_feature?(feature)
    features_list.include?(feature)
  end

  private

  def validate_features
    return if features.blank?

    parsed = features_list
    unless parsed.is_a?(Array)
      errors.add(:features, "must be an array")
      return
    end

    invalid_features = parsed - AVAILABLE_FEATURES
    if invalid_features.any?
      errors.add(:features, "contains invalid features: #{invalid_features.join(', ')}")
    end
  end
end
