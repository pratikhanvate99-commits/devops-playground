@echo off
echo Checking if Docker is running...
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not running. Please start Docker Desktop and try again.
    exit /b 1
)
echo Docker daemon is online.

if "%1"=="-Destroy" (
    echo Destroying infrastructure via Terraform...
    cd terraform
    terraform destroy -auto-approve
    cd ..
    echo Infrastructure destroyed successfully.
    exit /b 0
)

echo Building local microservices Docker images...

echo [1/3] Building Gateway Service...
docker build -t devops-gateway:latest ./services/gateway
if %errorlevel% neq 0 ( echo [ERROR] Failed to build Gateway image. & exit /b 1 )

echo [2/3] Building Worker Service...
docker build -t devops-worker:latest ./services/worker
if %errorlevel% neq 0 ( echo [ERROR] Failed to build Worker image. & exit /b 1 )

echo [3/3] Building Frontend Dashboard...
docker build -t devops-frontend:latest ./services/frontend
if %errorlevel% neq 0 ( echo [ERROR] Failed to build Frontend image. & exit /b 1 )

echo Docker images built successfully.

cd terraform

echo Initializing Terraform...
terraform init
if %errorlevel% neq 0 ( echo [ERROR] Terraform init failed. & cd .. & exit /b 1 )

echo Applying Terraform infrastructure...
terraform apply -auto-approve
if %errorlevel% neq 0 ( echo [ERROR] Terraform apply failed. & cd .. & exit /b 1 )

cd ..

echo.
echo ==================================================
echo  DEVOPS PLAYGROUND IS FULLY RUNNING!
echo ==================================================
echo  Control Center:   http://localhost:3000
echo  Grafana Metrics:  http://localhost:3001
echo  Prometheus:       http://localhost:9090
echo  cAdvisor:         http://localhost:8088
echo ==================================================
echo  To stop: run.bat -Destroy
echo ==================================================
