FactoryBot.define do
  factory :membership_type do
    sequence(:name) { |n| "Membership #{n}" }
    features { [ '대화', '학습' ].to_json }
    duration_days { 30 }
    price { 50000 }
  end
end
