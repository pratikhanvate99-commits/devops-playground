# deploy-k8s.ps1
# Kubernetes deployment and orchestration script for DevOps Playground

param(
    [switch]$Destroy,
    [switch]$BuildImages
)

$Namespace = "devops-playground"
$K8sDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Helper function to stop background port forwarding
function Stop-PortForwarding {
    Write-Host "Stopping active port-forwarding processes..." -ForegroundColor Yellow
    Get-CimInstance Win32_Process -Filter "Name = 'kubectl.exe'" | Where-Object { $_.CommandLine -like "*port-forward*" } | ForEach-Object {
        try {
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
            Write-Host "Stopped port-forward process (PID: $_.ProcessId)" -ForegroundColor DarkGray
        } catch {}
    }
}

if ($Destroy) {
    Write-Host "=== Teardown Kubernetes Infrastructure ===" -ForegroundColor Red
    
    # 1. Stop port forwarding
    Stop-PortForwarding

    # 2. Delete Namespace (this deletes all resources inside the namespace)
    Write-Host "Deleting namespace '$Namespace'..." -ForegroundColor Yellow
    kubectl delete namespace $Namespace --ignore-not-found=true

    Write-Host "Teardown complete!" -ForegroundColor Green
    exit 0
}

Write-Host "=== Deploying DevOps Playground to Kubernetes ===" -ForegroundColor Cyan

# 1. Check if cluster is active
Write-Host "Checking Kubernetes cluster status..."
kubectl cluster-info > $null 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Kubernetes cluster is not reachable. Please ensure Docker Desktop, Minikube, or Kind is running."
    exit 1
}
Write-Host "Kubernetes cluster is online." -ForegroundColor Green

# 2. Build Docker images if requested or not present
if ($BuildImages) {
    Write-Host "Building Docker images inside local daemon..." -ForegroundColor Yellow
    
    Write-Host "[1/3] Building Gateway Service..."
    docker build -t devops-gateway:latest "$K8sDir/../services/gateway"
    if ($LASTEXITCODE -ne 0) { throw "Gateway build failed." }

    Write-Host "[2/3] Building Worker Service..."
    docker build -t devops-worker:latest "$K8sDir/../services/worker"
    if ($LASTEXITCODE -ne 0) { throw "Worker build failed." }

    Write-Host "[3/3] Building Frontend Service..."
    docker build -t devops-frontend:latest "$K8sDir/../services/frontend"
    if ($LASTEXITCODE -ne 0) { throw "Frontend build failed." }

    Write-Host "Docker images built successfully." -ForegroundColor Green
}

# 3. Apply Namespace first
Write-Host "Applying namespace..."
kubectl apply -f "$K8sDir/namespace.yaml"

# 4. Generate ConfigMaps dynamically from configuration files
Write-Host "Generating ConfigMaps from project configurations..." -ForegroundColor Yellow

# postgres-init
kubectl create configmap postgres-init --from-file=init.sql="$K8sDir/../services/db/init.sql" --namespace=$Namespace --dry-run=client -o yaml | kubectl apply -f -

# prometheus-config
kubectl create configmap prometheus-config --from-file=prometheus.yml="$K8sDir/../monitoring/prometheus.yml" --namespace=$Namespace --dry-run=client -o yaml | kubectl apply -f -

# grafana-datasources
kubectl create configmap grafana-datasources --from-file=datasource.yml="$K8sDir/../monitoring/grafana/provisioning/datasources/datasource.yml" --namespace=$Namespace --dry-run=client -o yaml | kubectl apply -f -

# grafana-providers
kubectl create configmap grafana-providers --from-file=dashboard.yml="$K8sDir/../monitoring/grafana/provisioning/dashboards/dashboard.yml" --namespace=$Namespace --dry-run=client -o yaml | kubectl apply -f -

# grafana-dashboards
kubectl create configmap grafana-dashboards --from-file=devops_playground.json="$K8sDir/../monitoring/grafana/provisioning/dashboards/devops_playground.json" --namespace=$Namespace --dry-run=client -o yaml | kubectl apply -f -

# 5. Apply manifests
Write-Host "Applying Kubernetes manifests..." -ForegroundColor Yellow
kubectl apply -f "$K8sDir/postgres-pvc.yaml"
kubectl apply -f "$K8sDir/postgres-service.yaml"
kubectl apply -f "$K8sDir/postgres-deployment.yaml"

kubectl apply -f "$K8sDir/gateway-service.yaml"
kubectl apply -f "$K8sDir/gateway-deployment.yaml"

kubectl apply -f "$K8sDir/worker-service.yaml"
kubectl apply -f "$K8sDir/worker-deployment.yaml"

kubectl apply -f "$K8sDir/frontend-service.yaml"
kubectl apply -f "$K8sDir/frontend-deployment.yaml"

kubectl apply -f "$K8sDir/prometheus-service.yaml"
kubectl apply -f "$K8sDir/prometheus-deployment.yaml"

kubectl apply -f "$K8sDir/grafana-service.yaml"
kubectl apply -f "$K8sDir/grafana-deployment.yaml"

# 6. Wait for deployments to be ready
Write-Host "Waiting for deployments to stabilize..." -ForegroundColor Yellow
$Deployments = @("db", "gateway", "worker", "frontend", "prometheus", "grafana")
foreach ($dep in $Deployments) {
    Write-Host "Waiting for deployment/$dep..."
    kubectl rollout status deployment/$dep --namespace=$Namespace --timeout=60s
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Deployment/$dep failed to stabilize in 60 seconds."
    }
}

# 7. Start port forwarding
Stop-PortForwarding

Write-Host "Starting port-forwarding to local host ports..." -ForegroundColor Yellow

# Expose Frontend
Start-Process kubectl -ArgumentList "port-forward svc/frontend 3000:3000 --namespace=$Namespace" -WindowStyle Hidden
# Expose Gateway
Start-Process kubectl -ArgumentList "port-forward svc/gateway 5000:5000 --namespace=$Namespace" -WindowStyle Hidden
# Expose Worker
Start-Process kubectl -ArgumentList "port-forward svc/worker 5001:5001 --namespace=$Namespace" -WindowStyle Hidden
# Expose Prometheus
Start-Process kubectl -ArgumentList "port-forward svc/prometheus 9090:9090 --namespace=$Namespace" -WindowStyle Hidden
# Expose Grafana
Start-Process kubectl -ArgumentList "port-forward svc/grafana 3001:3000 --namespace=$Namespace" -WindowStyle Hidden

Start-Sleep -Seconds 3

Write-Host "`n==================================================" -ForegroundColor Green
Write-Host "  DEVOPS PLAYGROUND IS RUNNING ON KUBERNETES!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host "  Control Center:   http://localhost:3000"
Write-Host "  Grafana Metrics:  http://localhost:3001"
Write-Host "  Prometheus:       http://localhost:9090"
Write-Host "=================================================="
Write-Host "  To stop: .\kubernetes\deploy-k8s.ps1 -Destroy" -ForegroundColor Yellow
Write-Host "=================================================="
