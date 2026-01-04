module Api
  module V1
    class SessionsController < BaseController
      # Mock authentication - no real auth required
      def create
        user = User.find_by(email: params[:email])

        if user
          render json: {
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              has_active_membership: user.has_active_membership?
            }
          }
        else
          render json: { error: "User not found" }, status: :not_found
        end
      end

      def show
        user = User.find(params[:id])
        render json: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            has_active_membership: user.has_active_membership?
          }
        }
      end
    end
  end
end
