#!/bin/bash
# Deploy script for Louis video processing pipeline
# Handles both frontend and backend deployment

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Functions
log_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
  echo -e "${RED}❌ $1${NC}"
  exit 1
}

# Check prerequisites
check_prerequisites() {
  log_info "Checking prerequisites..."
  
  if ! command -v node &> /dev/null; then
    log_error "Node.js not found. Please install Node.js 18+"
  fi
  
  if ! command -v wrangler &> /dev/null; then
    log_info "Installing Wrangler..."
    npm install -g wrangler
  fi
  
  log_success "Prerequisites checked"
}

# Setup environment
setup_environment() {
  log_info "Setting up environment..."
  
  if [ ! -f .env.local ]; then
    log_warning ".env.local not found, creating from template"
    cp .env.example .env.local
    log_warning "Please fill in .env.local with your API credentials before deploying"
  fi
  
  log_success "Environment configured"
}

# Deploy frontend
deploy_frontend() {
  log_info "Building frontend..."
  
  cd frontend
  npm install
  npm run build
  
  log_success "Frontend built successfully"
  
  echo ""
  log_info "Frontend ready for deployment:"
  log_info "  Build output: frontend/dist/"
  log_info "  Next steps:"
  log_info "    1. Push to GitHub repository"
  log_info "    2. Configure Cloudflare Pages to auto-deploy"
  log_info "    Build config:"
  log_info "      Framework: Vite"
  log_info "      Build command: npm run build"
  log_info "      Output dir: dist"
}

# Deploy backend
deploy_backend() {
  log_info "Deploying backend to Cloudflare Workers..."
  
  cd backend
  npm install
  
  log_info "Running Wrangler authentication..."
  wrangler login
  
  log_info "Deploying to production..."
  wrangler deploy
  
  log_success "Backend deployed successfully"
  
  # Get deployment URL
  WORKER_URL=$(wrangler deployments info --format json | jq -r '.deployment.url' 2>/dev/null || echo "https://louis.your-domain.workers.dev")
  
  echo ""
  log_info "Backend deployed to: $WORKER_URL"
  log_info "Test your deployment:"
  log_info "  curl $WORKER_URL/health"
}

# Run tests
run_tests() {
  log_info "Running tests..."
  
  cd "$(dirname "$0")"
  
  npm --prefix frontend run lint || log_warning "Frontend lint failed"
  npm --prefix backend run lint || log_warning "Backend lint failed"
  
  log_success "Tests completed"
}

# Main deployment flow
main() {
  echo ""
  log_info "🚀 Louis Deployment Script"
  echo ""
  
  # Parse arguments
  DEPLOY_TYPE="${1:-both}"
  
  case $DEPLOY_TYPE in
    frontend)
      check_prerequisites
      setup_environment
      deploy_frontend
      ;;
    backend)
      check_prerequisites
      setup_environment
      deploy_backend
      ;;
    both)
      check_prerequisites
      setup_environment
      deploy_frontend
      echo ""
      deploy_backend
      ;;
    test)
      run_tests
      ;;
    *)
      log_error "Usage: ./deploy.sh [frontend|backend|both|test]"
      ;;
  esac
  
  echo ""
  log_success "Deployment complete!"
}

main "$@"
