class CreateMembershipTypes < ActiveRecord::Migration[8.1]
  def change
    create_table :membership_types do |t|
      t.string :name, null: false
      t.text :features, null: false
      t.integer :duration_days, null: false
      t.decimal :price, precision: 10, scale: 2, null: false

      t.timestamps
    end
  end
end
