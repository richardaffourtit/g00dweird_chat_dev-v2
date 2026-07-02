#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_DIR="$(cd "$APP_DIR/.." && pwd)"

cd "$REPO_DIR"

if [[ ! -f render.yaml ]]; then
  echo "missing root render.yaml"
  exit 1
fi

ruby -ryaml <<'RUBY'
data = YAML.load_file("render.yaml")
services = data.fetch("services")
raise "render.yaml must define exactly 2 services" unless services.length == 2

backend = services.find { |service| service["name"] == "g00dweird-api" }
frontend = services.find { |service| service["name"] == "g00dweird-chat" }
raise "missing g00dweird-api service" unless backend
raise "missing g00dweird-chat service" unless frontend

raise "backend must stay single-instance until realtime state is externalized" unless backend["numInstances"] == 1
raise "backend rootDir changed" unless backend["rootDir"] == "g00dweird_chat-main/backend"
raise "backend health check should be /api/health" unless backend["healthCheckPath"] == "/api/health"
raise "backend domain should be api.g00dweird.com" unless backend.fetch("domains") == ["api.g00dweird.com"]

backend_env = backend.fetch("envVars").map { |item| [item.fetch("key"), item] }.to_h
%w[PYTHON_VERSION MONGO_URL DB_NAME CORS_ORIGINS REALTIME_MODE OBJECT_STORAGE_PROVIDER LOCAL_STORAGE_DIR].each do |key|
  raise "backend missing env var #{key}" unless backend_env.key?(key)
end
raise "MONGO_URL must stay secret/sync:false" unless backend_env.fetch("MONGO_URL")["sync"] == false
raise "REALTIME_MODE must be single-instance for launch" unless backend_env.fetch("REALTIME_MODE")["value"] == "single-instance"
cors_origins = backend_env.fetch("CORS_ORIGINS")["value"].to_s.split(",")
raise "backend CORS must allow Render staging frontend" unless cors_origins.include?("https://g00dweird-chat.onrender.com")

raise "frontend must be a static web service" unless frontend["type"] == "web" && frontend["runtime"] == "static"
raise "frontend rootDir changed" unless frontend["rootDir"] == "g00dweird_chat-main/frontend"
raise "frontend publish path must be relative to rootDir" unless frontend["staticPublishPath"] == "build"
raise "frontend first launch should only claim chat.g00dweird.com" unless frontend.fetch("domains") == ["chat.g00dweird.com"]

frontend_env = frontend.fetch("envVars").map { |item| [item.fetch("key"), item] }.to_h
%w[NODE_VERSION VITE_BACKEND_URL VITE_PREVIEW_MOCK VITE_USE_CLEANED_SPRITES].each do |key|
  raise "frontend missing env var #{key}" unless frontend_env.key?(key)
end
raise "frontend backend URL mismatch" unless frontend_env.fetch("VITE_BACKEND_URL")["value"] == "https://g00dweird-api.onrender.com"

puts "render.yaml launch config ok"
RUBY

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if git ls-files g00dweird_chat-main/backend/.mongo-data g00dweird_chat-main/backend/.mongo-logs | grep -q .; then
    echo "local Mongo files are still tracked"
    exit 1
  fi
fi

echo "launch preflight ok"
