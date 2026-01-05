.PHONY: setup dev test test-server test-web docker-up docker-down help

help:
	@echo "사용 가능한 명령어:"
	@echo "  make setup        - 프로젝트 초기 설정 (의존성 설치 및 DB 세팅)"
	@echo "  make dev          - 로컬 서버 실행 (프론트 + 백엔드)"
	@echo "  make test         - 전체 테스트 실행 (프론트 + 백엔드)"
	@echo "  make test-server  - 백엔드 테스트만 실행"
	@echo "  make test-web     - 프론트엔드 테스트만 실행"
	@echo "  make docker-up    - 도커 환경에서 실행"
	@echo "  make docker-down  - 도커 환경 종료"

# 로컬 실행 관련
setup:
	npm install
	cd web && npm install
	cd server && bundle install
	cd server && bin/rails db:prepare db:seed

dev:
	npm run dev

test: test-server test-web

test-server:
	@echo "=== 백엔드 테스트 실행 ==="
	cd server && bundle exec rspec

test-web:
	@echo "=== 프론트엔드 테스트 실행 ==="
	cd web && npm run test:run

# 도커 관련
docker-up:
	docker-compose up --build

docker-down:
	docker-compose down
