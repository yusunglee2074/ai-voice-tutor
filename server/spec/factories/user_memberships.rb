FactoryBot.define do
  factory :user_membership do
    association :user
    association :membership_type
    valid_from { Time.current }
    valid_to { 30.days.from_now }
    status { 'active' }

    trait :expired do
      valid_from { 60.days.ago }
      valid_to { 30.days.ago }
      status { 'expired' }
    end

    trait :cancelled do
      status { 'cancelled' }
    end
  end
end
