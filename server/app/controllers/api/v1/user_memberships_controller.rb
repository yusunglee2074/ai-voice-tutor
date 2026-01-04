module Api
  module V1
    class UserMembershipsController < BaseController
      def index
        @user = User.find(params[:user_id])
        @memberships = @user.user_memberships.includes(:membership_type).order(created_at: :desc)

        render json: @memberships.map { |um| serialize(um) }
      end

      private

      def serialize(membership)
        {
          id: membership.id,
          membership_type: {
            id: membership.membership_type.id,
            name: membership.membership_type.name,
            features: membership.membership_type.features_list
          },
          valid_from: membership.valid_from,
          valid_to: membership.valid_to,
          status: membership.status,
          is_active: membership.active?
        }
      end
    end
  end
end
