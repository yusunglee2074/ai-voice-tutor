module Api
  module V1
    module Admin
      class UsersController < BaseController
        def index
          @users = User.all.order(created_at: :desc)

          # Search by email or name
          if params[:q].present?
            query = "%#{params[:q]}%"
            @users = @users.where("email LIKE ? OR name LIKE ?", query, query)
          end

          # Pagination
          page = (params[:page] || 1).to_i
          per_page = (params[:per_page] || 20).to_i
          total = @users.count
          @users = @users.offset((page - 1) * per_page).limit(per_page)

          render json: {
            users: @users.map { |u| serialize(u) },
            meta: {
              total: total,
              page: page,
              per_page: per_page,
              total_pages: (total.to_f / per_page).ceil
            }
          }
        end

        def show
          @user = User.find(params[:id])
          render json: serialize(@user, include_memberships: true)
        end

        private

        def serialize(user, include_memberships: false)
          data = {
            id: user.id,
            email: user.email,
            name: user.name,
            has_active_membership: user.has_active_membership?,
            created_at: user.created_at,
            updated_at: user.updated_at
          }

          if include_memberships
            data[:memberships] = user.user_memberships.includes(:membership_type).map do |um|
              {
                id: um.id,
                membership_type: {
                  id: um.membership_type.id,
                  name: um.membership_type.name,
                  features: um.membership_type.features_list
                },
                valid_from: um.valid_from,
                valid_to: um.valid_to,
                status: um.status,
                is_active: um.active?
              }
            end
          end

          data
        end
      end
    end
  end
end
