# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_01_04_055333) do
  create_table "membership_types", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "duration_days", null: false
    t.text "features", null: false
    t.string "name", null: false
    t.decimal "price", precision: 10, scale: 2, null: false
    t.datetime "updated_at", null: false
  end

  create_table "user_memberships", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.integer "membership_type_id", null: false
    t.string "status", default: "active", null: false
    t.datetime "updated_at", null: false
    t.integer "user_id", null: false
    t.datetime "valid_from", null: false
    t.datetime "valid_to", null: false
    t.index ["membership_type_id"], name: "index_user_memberships_on_membership_type_id"
    t.index ["user_id", "status"], name: "index_user_memberships_on_user_id_and_status"
    t.index ["user_id"], name: "index_user_memberships_on_user_id"
    t.index ["valid_to"], name: "index_user_memberships_on_valid_to"
  end

  create_table "users", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "email", null: false
    t.string "name", null: false
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email", unique: true
  end

  add_foreign_key "user_memberships", "membership_types"
  add_foreign_key "user_memberships", "users"
end
