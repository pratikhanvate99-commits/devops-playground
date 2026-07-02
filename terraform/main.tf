terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0.2"
    }
  }
}

provider "docker" {
  # On Windows, standard named pipe is used by default: npipe:////./pipe/docker_engine
}

# 1. Private Bridge Network
resource "docker_network" "private_network" {
  name = "devops_playground_network"
}

# 2. Persistent Volume for Postgres Database
resource "docker_volume" "db_data" {
  name = "devops_db_data"
}

# 3. Database Service Container
resource "docker_container" "db" {
  name  = "db"
  image = "postgres:16-alpine"
  networks_advanced {
    name = docker_network.private_network.name
  }
  env = [
    "POSTGRES_DB=devops_db",
    "POSTGRES_USER=postgres",
    "POSTGRES_PASSWORD=postgres"
  ]
  volumes {
    volume_name    = docker_volume.db_data.name
    container_path = "/var/lib/postgresql/data"
  }
  volumes {
    host_path      = abspath("${path.module}/../services/db/init.sql")
    container_path = "/docker-entrypoint-initdb.d/init.sql"
    read_only      = true
  }
  ports {
    internal = 5432
    external = 5432
  }
  healthcheck {
    test     = ["CMD-SHELL", "pg_isready -U postgres -d devops_db"]
    interval = "5s"
    timeout  = "3s"
    retries  = 3
  }
}

# 4. API Gateway Container
resource "docker_container" "gateway" {
  name    = "gateway"
  image   = "devops-gateway:latest"
  restart = "always"
  networks_advanced {
    name = docker_network.private_network.name
  }
  env = [
    "DATABASE_URL=postgresql://postgres:postgres@db:5432/devops_db",
    "PORT=5000"
  ]
  ports {
    internal = 5000
    external = 5000
  }
  healthcheck {
    test     = ["CMD-SHELL", "wget --quiet --tries=1 --spider http://localhost:5000/api/status || exit 1"]
    interval = "5s"
    timeout  = "3s"
    retries  = 3
  }
  depends_on = [
    docker_container.db
  ]
}

# 5. Worker Service Container
resource "docker_container" "worker" {
  name    = "worker"
  image   = "devops-worker:latest"
  restart = "always"
  networks_advanced {
    name = docker_network.private_network.name
  }
  env = [
    "DATABASE_URL=postgresql://postgres:postgres@db:5432/devops_db"
  ]
  ports {
    internal = 5001
    external = 5001
  }
  depends_on = [
    docker_container.db
  ]
}

# 6. Prometheus Service Container
resource "docker_container" "prometheus" {
  name  = "prometheus"
  image = "prom/prometheus:v2.52.0"
  networks_advanced {
    name = docker_network.private_network.name
  }
  ports {
    internal = 9090
    external = 9090
  }
  volumes {
    host_path      = abspath("${path.module}/../monitoring/prometheus.yml")
    container_path = "/etc/prometheus/prometheus.yml"
    read_only      = true
  }
}

# 7. Grafana Service Container
resource "docker_container" "grafana" {
  name  = "grafana"
  image = "grafana/grafana:11.0.0"
  networks_advanced {
    name = docker_network.private_network.name
  }
  ports {
    internal = 3000
    external = 3001
  }
  env = [
    "GF_AUTH_ANONYMOUS_ENABLED=true",
    "GF_AUTH_ANONYMOUS_ORG_ROLE=Admin",
    "GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD_PATH=/etc/grafana/provisioning/dashboards/devops_playground.json"
  ]
  volumes {
    host_path      = abspath("${path.module}/../monitoring/grafana/provisioning/datasources")
    container_path = "/etc/grafana/provisioning/datasources"
    read_only      = true
  }
  volumes {
    host_path      = abspath("${path.module}/../monitoring/grafana/provisioning/dashboards")
    container_path = "/etc/grafana/provisioning/dashboards"
    read_only      = true
  }
  depends_on = [
    docker_container.prometheus
  ]
}

# 8. cAdvisor Service Container
resource "docker_container" "cadvisor" {
  name  = "cadvisor"
  image = "gcr.io/cadvisor/cadvisor:v0.49.1"
  networks_advanced {
    name = docker_network.private_network.name
  }
  ports {
    internal = 8080
    external = 8088
  }
  volumes {
    host_path      = "/var/run/docker.sock"
    container_path = "/var/run/docker.sock"
    read_only      = true
  }
}

# 9. Frontend React App Container
resource "docker_container" "frontend" {
  name    = "frontend"
  image   = "devops-frontend:latest"
  restart = "always"
  networks_advanced {
    name = docker_network.private_network.name
  }
  ports {
    internal = 3000
    external = 3000
  }
  depends_on = [
    docker_container.gateway
  ]
}
