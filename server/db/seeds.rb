# Membership Types
puts "Creating membership types..."

basic = MembershipType.find_or_create_by!(name: '베이직') do |mt|
  mt.features = ['대화'].to_json
  mt.duration_days = 30
  mt.price = 29000
end

standard = MembershipType.find_or_create_by!(name: '스탠다드') do |mt|
  mt.features = ['학습', '대화'].to_json
  mt.duration_days = 30
  mt.price = 49000
end

premium = MembershipType.find_or_create_by!(name: '프리미엄') do |mt|
  mt.features = ['학습', '대화', '분석'].to_json
  mt.duration_days = 30
  mt.price = 79000
end

puts "Created #{MembershipType.count} membership types"

# Users
puts "Creating users..."

admin = User.find_or_create_by!(email: 'admin@example.com') do |u|
  u.name = '관리자'
end

user1 = User.find_or_create_by!(email: 'user1@example.com') do |u|
  u.name = '홍길동'
end

user2 = User.find_or_create_by!(email: 'user2@example.com') do |u|
  u.name = '김철수'
end

user3 = User.find_or_create_by!(email: 'user3@example.com') do |u|
  u.name = '이영희'
end

puts "Created #{User.count} users"

# User Memberships
puts "Creating user memberships..."

# user1: active premium membership
UserMembership.find_or_create_by!(user: user1, membership_type: premium) do |um|
  um.valid_from = Time.current
  um.valid_to = 30.days.from_now
  um.status = 'active'
end

# user2: expired basic membership
UserMembership.find_or_create_by!(user: user2, membership_type: basic) do |um|
  um.valid_from = 60.days.ago
  um.valid_to = 30.days.ago
  um.status = 'expired'
end

# user3: no membership

puts "Created #{UserMembership.count} user memberships"

puts "Seed completed!"
