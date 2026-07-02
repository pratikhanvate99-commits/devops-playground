# PowerShell startup script for DevOps Playground
param (
    [switch]$Destroy
)

$ErrorActionPreference = "Stop"

# Get script directory
$projectRoot = $PSScriptRoot
if (-not $projectRoot) {
    $projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
}
Set-Location $projectRoot

# 1. Verify Docker daemon is running
Write-Host "Checking if Docker is running..." -ForegroundColor Cyan
docker ps > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Docker is not running or not accessible. Please start Docker Desktop and try again."
    exit 1
}
Write-Host "✔ Docker daemon is online." -ForegroundColor Green

# 2. Check if we need to teardown the setup
if ($Destroy.IsPresent) {
    Write-Host "Destroying infrastructure via Terraform..." -ForegroundColor Yellow
    Set-Location "$projectRoot\terraform"
    terraform init
    terraform destroy -auto-approve
    Set-Location $projectRoot
    Write-Host "✔ Infrastructure destroyed successfully." -ForegroundColor Green
    exit 0
}

# 3. Build local microservices images
Write-Host "Building local microservices Docker images..." -ForegroundColor Cyan

Write-Host "Building Gateway Service image [1/3]..." -ForegroundColor Yellow
docker build -t devops-gateway:latest ./services/gateway

Write-Host "Building Worker Service image [2/3]..." -ForegroundColor Yellow
docker build -t devops-worker:latest ./services/worker

Write-Host "Building Frontend Dashboard image [3/3]..." -ForegroundColor Yellow
docker build -t devops-frontend:latest ./services/frontend

Write-Host "✔ Docker images built successfully." -ForegroundColor Green

# 4. Initialize and apply Terraform configurations
Write-Host "Initializing Terraform..." -ForegroundColor Cyan
Set-Location "$projectRoot\terraform"
terraform init

Write-Host "Applying Terraform infrastructure changes..." -ForegroundColor Cyan
terraform apply -auto-approve

Write-Host "`n==================================================" -ForegroundColor Green
Write-Host "✔ DEVOPS PLAYGROUND IS FULLY RUNNING!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host "Open the Control Center:  http://localhost:3000" -ForegroundColor Cyan
Write-Host "Open Grafana Metrics:    http://localhost:3001" -ForegroundColor Cyan
Write-Host "Open Prometheus Console: http://localhost:9090" -ForegroundColor Cyan
Write-Host "Open cAdvisor Status:    http://localhost:8080" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Green
Write-Host "To destroy the setup later, run: .\run.ps1 -Destroy" -ForegroundColor Yellow

Set-Location $projectRoot
