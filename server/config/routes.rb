Rails.application.routes.draw do
  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      # Public APIs
      resources :membership_types, only: [:index, :show]
      resources :users, only: [] do
        resources :memberships, only: [:index], controller: 'user_memberships'
      end

      # Admin APIs
      namespace :admin do
        resources :membership_types, only: [:index, :show, :create, :update, :destroy]
        resources :users, only: [:index, :show] do
          resources :memberships, only: [:index, :create, :destroy], controller: 'user_memberships'
        end
      end
    end
  end
end
