module Api
  module V1
    module Admin
      class MembershipTypesController < BaseController
        def index
          @membership_types = MembershipType.all.order(created_at: :desc)
          render json: @membership_types.map { |mt| serialize(mt) }
        end

        def show
          @membership_type = MembershipType.find(params[:id])
          render json: serialize(@membership_type)
        end

        def create
          @membership_type = MembershipType.new(membership_type_params)
          @membership_type.features = params[:membership_type][:features].to_json if params[:membership_type][:features].is_a?(Array)

          if @membership_type.save
            render json: serialize(@membership_type), status: :created
          else
            render json: { errors: @membership_type.errors.full_messages }, status: :unprocessable_entity
          end
        end

        def update
          @membership_type = MembershipType.find(params[:id])
          @membership_type.assign_attributes(membership_type_params)
          @membership_type.features = params[:membership_type][:features].to_json if params[:membership_type][:features].is_a?(Array)

          if @membership_type.save
            render json: serialize(@membership_type)
          else
            render json: { errors: @membership_type.errors.full_messages }, status: :unprocessable_entity
          end
        end

        def destroy
          @membership_type = MembershipType.find(params[:id])

          if @membership_type.destroy
            head :no_content
          else
            render json: { errors: @membership_type.errors.full_messages }, status: :unprocessable_entity
          end
        end

        private

        def membership_type_params
          params.require(:membership_type).permit(:name, :duration_days, :price)
        end

        def serialize(membership_type)
          {
            id: membership_type.id,
            name: membership_type.name,
            features: membership_type.features_list,
            duration_days: membership_type.duration_days,
            price: membership_type.price.to_f,
            created_at: membership_type.created_at,
            updated_at: membership_type.updated_at
          }
        end
      end
    end
  end
end
