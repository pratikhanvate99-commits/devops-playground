output "control_center_url" {
  value       = "http://localhost:3000"
  description = "URL for the React-based DevOps Playground Dashboard Control Center"
}

output "api_gateway_url" {
  value       = "http://localhost:5000"
  description = "URL for the Node.js API Gateway"
}

output "worker_service_url" {
  value       = "http://localhost:5001"
  description = "URL for the Python Flask Worker Service"
}

output "grafana_url" {
  value       = "http://localhost:3001"
  description = "URL for the Grafana Monitoring Dashboard (anonymous login enabled)"
}

output "prometheus_url" {
  value       = "http://localhost:9090"
  description = "URL for the Prometheus query console"
}

output "cadvisor_url" {
  value       = "http://localhost:8088"
  description = "URL for raw cAdvisor container statistics"
}
