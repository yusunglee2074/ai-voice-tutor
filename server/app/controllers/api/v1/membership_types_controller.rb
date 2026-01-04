module Api
  module V1
    class MembershipTypesController < BaseController
      def index
        @membership_types = MembershipType.all.order(:name)
        render json: @membership_types.map { |mt| serialize(mt) }
      end

      def show
        @membership_type = MembershipType.find(params[:id])
        render json: serialize(@membership_type)
      end

      private

      def serialize(membership_type)
        {
          id: membership_type.id,
          name: membership_type.name,
          features: membership_type.features_list,
          duration_days: membership_type.duration_days,
          price: membership_type.price.to_f
        }
      end
    end
  end
end
