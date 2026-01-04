class CreateUserMemberships < ActiveRecord::Migration[8.1]
  def change
    create_table :user_memberships do |t|
      t.references :user, null: false, foreign_key: true
      t.references :membership_type, null: false, foreign_key: true
      t.datetime :valid_from, null: false
      t.datetime :valid_to, null: false
      t.string :status, null: false, default: 'active'

      t.timestamps
    end

    add_index :user_memberships, [ :user_id, :status ]
    add_index :user_memberships, :valid_to
  end
end
