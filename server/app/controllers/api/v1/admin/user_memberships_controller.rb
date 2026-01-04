module Api
  module V1
    module Admin
      class UserMembershipsController < BaseController
        before_action :set_user

        def index
          @memberships = @user.user_memberships.includes(:membership_type).order(created_at: :desc)
          render json: @memberships.map { |um| serialize(um) }
        end

        def create
          membership_type = MembershipType.find(params[:membership_type_id])

          @membership = @user.user_memberships.new(
            membership_type: membership_type,
            valid_from: Time.current,
            valid_to: membership_type.duration_days.days.from_now,
            status: "active"
          )

          if @membership.save
            render json: serialize(@membership), status: :created
          else
            render json: { errors: @membership.errors.full_messages }, status: :unprocessable_entity
          end
        end

        def destroy
          @membership = @user.user_memberships.find(params[:id])
          @membership.cancel!
          head :no_content
        end

        private

        def set_user
          @user = User.find(params[:user_id])
        end

        def serialize(membership)
          {
            id: membership.id,
            user_id: membership.user_id,
            membership_type: {
              id: membership.membership_type.id,
              name: membership.membership_type.name,
              features: membership.membership_type.features_list
            },
            valid_from: membership.valid_from,
            valid_to: membership.valid_to,
            status: membership.status,
            is_active: membership.active?,
            created_at: membership.created_at
          }
        end
      end
    end
  end
end
