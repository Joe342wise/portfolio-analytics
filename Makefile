.PHONY: dev test k8s-dev load-test eval-var eval-rag deploy-stage deploy-prod clean

dev:
	@echo "Starting development environment..."
	docker-compose up --build

dev-detach:
	docker-compose up -d --build

stop:
	docker-compose down

clean:
	docker-compose down -v
	rm -rf node_modules
	rm -rf api/node_modules web/node_modules
	rm -rf workers/simulation/__pycache__ rag-service/__pycache__

test:
	@echo "Running all tests..."
	cd api && npm test
	cd workers/simulation && pytest --cov=tasks
	cd rag-service && pytest --cov=src

test-api:
	cd api && npm test -- --coverage

test-workers:
	cd workers/simulation && pytest -v --cov=tasks

test-integration:
	docker-compose -f docker-compose.test.yml up --abort-on-container-exit

k8s-dev:
	@echo "Deploying to local Kubernetes..."
	kubectl config use-context docker-desktop
	helm upgrade --install portfolio-analytics infra/k8s/api -f infra/k8s/values-dev.yaml

load-test:
	@echo "Running load tests with k6..."
	k6 run scripts/load_test.js

eval-var:
	@echo "Running VaR backtest evaluation..."
	python evals/var_backtest.py

eval-rag:
	@echo "Running RAG retrieval evaluation..."
	python evals/rag_eval.py

seed:
	@echo "Seeding database and Weaviate..."
	docker-compose exec api npm run seed
	python scripts/seed_filings.py

mock-market:
	@echo "Starting mock market data feed..."
	python scripts/mock_market_feed.py

install:
	@echo "Installing dependencies..."
	cd api && npm install
	cd web && npm install
	cd workers/simulation && pip install -r requirements.txt
	cd rag-service && pip install -r requirements.txt

deploy-stage:
	@echo "Deploying to staging..."
	argocd app sync portfolio-analytics-staging

deploy-prod:
	@echo "Deploying to production..."
	argocd app sync portfolio-analytics-prod

logs-api:
	docker-compose logs -f api

logs-workers:
	docker-compose logs -f celery-worker

logs-market:
	docker-compose logs -f market-ingest
