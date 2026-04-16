#!/usr/bin/env bash
# =============================================================================
# install.sh — Zebra BU Mapping Service installer for RHEL-based systems
# =============================================================================
# Installs Docker + Docker Compose, configures environment variables, and
# deploys the service via Docker Compose.
#
# Usage:
#   sudo ./install.sh [OPTIONS]
#
# Options:
#   --env-file <path>   Path to a pre-existing .env file to use instead of
#                       the interactive prompt.
#   --non-interactive   Skip all prompts; use defaults / env-file values only.
#   -h, --help          Show this help message and exit.
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Colour helpers
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

log_info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
log_success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
log_error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; }
log_step()    { echo -e "\n${BOLD}==> $*${RESET}"; }

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
ENV_FILE_ARG=""
NON_INTERACTIVE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      ENV_FILE_ARG="$2"
      shift 2
      ;;
    --non-interactive)
      NON_INTERACTIVE=true
      shift
      ;;
    -h|--help)
      sed -n '/^# Usage:/,/^# =====/p' "$0" | grep -v '^# ====='
      exit 0
      ;;
    *)
      log_error "Unknown option: $1"
      exit 1
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Privilege check
# ---------------------------------------------------------------------------
log_step "Checking privileges"
if [[ $EUID -ne 0 ]]; then
  log_error "This script must be run as root or with sudo."
  log_error "Try: sudo $0 $*"
  exit 1
fi
log_success "Running as root."

# ---------------------------------------------------------------------------
# OS detection — warn if not RHEL-based
# ---------------------------------------------------------------------------
log_step "Detecting operating system"
if [[ -f /etc/os-release ]]; then
  # shellcheck source=/dev/null
  source /etc/os-release
  OS_ID="${ID:-unknown}"
  OS_NAME="${PRETTY_NAME:-unknown}"
  log_info "Detected: ${OS_NAME}"
  case "$OS_ID" in
    rhel|centos|fedora|rocky|almalinux|ol)
      log_success "RHEL-compatible OS confirmed."
      ;;
    *)
      log_warn "This script is designed for RHEL-based systems (rhel, centos, rocky, almalinux, fedora, ol)."
      log_warn "Detected '${OS_ID}'. Proceeding, but results may vary."
      ;;
  esac
else
  log_warn "/etc/os-release not found. Cannot determine OS. Proceeding anyway."
fi

# ---------------------------------------------------------------------------
# Package manager detection (dnf preferred, yum fallback)
# ---------------------------------------------------------------------------
if command -v dnf &>/dev/null; then
  PKG_MGR="dnf"
elif command -v yum &>/dev/null; then
  PKG_MGR="yum"
else
  log_error "Neither 'dnf' nor 'yum' package manager found. Cannot install dependencies."
  exit 1
fi
log_info "Using package manager: ${PKG_MGR}"

# ---------------------------------------------------------------------------
# Helper: install a package if not already present
# ---------------------------------------------------------------------------
ensure_package() {
  local pkg="$1"
  if ! rpm -q "$pkg" &>/dev/null; then
    log_info "Installing package: ${pkg}"
    $PKG_MGR install -y "$pkg" || {
      log_error "Failed to install '${pkg}'. Check network connectivity and yum/dnf repos."
      exit 1
    }
    log_success "Package installed: ${pkg}"
  else
    log_info "Package already installed: ${pkg}"
  fi
}

# ---------------------------------------------------------------------------
# Step 1: Install Docker
# ---------------------------------------------------------------------------
log_step "Step 1 of 5 — Installing Docker"

if command -v docker &>/dev/null; then
  DOCKER_VERSION=$(docker --version 2>&1)
  log_success "Docker already installed: ${DOCKER_VERSION}"
else
  log_info "Adding Docker CE repository…"
  ensure_package "yum-utils"

  # Choose the correct Docker CE repo for the distribution
  case "$OS_ID" in
    fedora)
      DOCKER_REPO_URL="https://download.docker.com/linux/fedora/docker-ce.repo"
      ;;
    *)
      # rhel, centos, rocky, almalinux, ol — all use the CentOS repo
      DOCKER_REPO_URL="https://download.docker.com/linux/centos/docker-ce.repo"
      ;;
  esac
  log_info "Using Docker repository: ${DOCKER_REPO_URL}"

  $PKG_MGR config-manager --add-repo "${DOCKER_REPO_URL}" 2>&1 | \
    while IFS= read -r line; do log_info "$line"; done

  log_info "Installing Docker CE packages…"
  $PKG_MGR install -y docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin 2>&1 | \
    while IFS= read -r line; do log_info "$line"; done

  log_success "Docker CE installed."
fi

# ---------------------------------------------------------------------------
# Step 2: Enable and start Docker service
# ---------------------------------------------------------------------------
log_step "Step 2 of 5 — Enabling Docker service"

if ! systemctl is-enabled docker &>/dev/null; then
  systemctl enable docker
  log_success "Docker service enabled (starts on boot)."
else
  log_info "Docker service already enabled."
fi

if ! systemctl is-active --quiet docker; then
  log_info "Starting Docker service…"
  systemctl start docker
  log_success "Docker service started."
else
  log_info "Docker service is already running."
fi

# Verify Docker is functional
if ! docker info &>/dev/null; then
  log_error "Docker is installed but not responding. Check 'systemctl status docker'."
  exit 1
fi
log_success "Docker is up and running."

# ---------------------------------------------------------------------------
# Step 3: Verify Docker Compose — determine compose command
# ---------------------------------------------------------------------------
log_step "Step 3 of 5 — Verifying Docker Compose"

DOCKER_COMPOSE_CMD=""
if docker compose version &>/dev/null 2>&1; then
  DC_VERSION=$(docker compose version 2>&1)
  log_success "Docker Compose plugin available: ${DC_VERSION}"
  DOCKER_COMPOSE_CMD="docker compose"
elif command -v docker-compose &>/dev/null; then
  DC_VERSION=$(docker-compose --version 2>&1)
  log_success "Standalone docker-compose available: ${DC_VERSION}"
  DOCKER_COMPOSE_CMD="docker-compose"
else
  log_info "Docker Compose plugin not found. Installing…"
  $PKG_MGR install -y docker-compose-plugin 2>&1 | \
    while IFS= read -r line; do log_info "$line"; done
  log_success "Docker Compose plugin installed."
  DOCKER_COMPOSE_CMD="docker compose"
fi

# ---------------------------------------------------------------------------
# Step 4: Configure environment variables
# ---------------------------------------------------------------------------
log_step "Step 4 of 5 — Configuring environment variables"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_DEST="${SCRIPT_DIR}/.env"
ENV_EXAMPLE="${SCRIPT_DIR}/.env.example"

# If an explicit env-file was provided, copy it and skip prompts
if [[ -n "$ENV_FILE_ARG" ]]; then
  if [[ ! -f "$ENV_FILE_ARG" ]]; then
    log_error "Provided --env-file path does not exist: ${ENV_FILE_ARG}"
    exit 1
  fi
  log_info "Using provided env file: ${ENV_FILE_ARG}"
  cp "$ENV_FILE_ARG" "$ENV_DEST"
  log_success ".env written from ${ENV_FILE_ARG}"
elif [[ -f "$ENV_DEST" ]] && [[ "$NON_INTERACTIVE" == "true" ]]; then
  log_info "Non-interactive mode: using existing .env file at ${ENV_DEST}"
else
  # Interactive prompt
  if [[ ! -f "$ENV_EXAMPLE" ]]; then
    log_error ".env.example not found in ${SCRIPT_DIR}. Cannot configure environment."
    exit 1
  fi

  echo ""
  echo -e "${BOLD}Environment Variable Configuration${RESET}"
  echo "  Press Enter to accept the default value shown in [brackets]."
  echo "  Sensitive values will not be echoed to the terminal."
  echo ""

  # ---- Helper: prompt for a value ----
  prompt_value() {
    local var_name="$1"
    local prompt_text="$2"
    local default_val="$3"
    local is_secret="${4:-false}"
    local user_input

    if [[ "$is_secret" == "true" ]]; then
      read -r -s -p "  ${prompt_text} [${default_val}]: " user_input
      echo ""
    else
      read -r -p "  ${prompt_text} [${default_val}]: " user_input
    fi
    echo "${user_input:-$default_val}"
  }

  # Prompt for each variable
  PORT=$(prompt_value PORT "Service port" "3000")
  MONGODB_URI=$(prompt_value MONGODB_URI "MongoDB URI" "mongodb://mongodb:27017/zebra-bu-mapping")
  API_KEY=$(prompt_value API_KEY "API key (secret)" "$(openssl rand -hex 32 2>/dev/null || true)" "true")
  if [[ -z "$API_KEY" ]]; then
    log_error "'openssl' is required to generate a random API key but was not found."
    log_error "Please install openssl ('$PKG_MGR install -y openssl') and re-run, or use --env-file with a pre-set API_KEY."
    exit 1
  fi
  AZURE_TENANT_ID=$(prompt_value AZURE_TENANT_ID "Azure Tenant ID (optional)" "")
  AZURE_CLIENT_ID=$(prompt_value AZURE_CLIENT_ID "Azure Client ID (optional)" "")
  AZURE_CLIENT_SECRET=$(prompt_value AZURE_CLIENT_SECRET "Azure Client Secret (optional)" "" "true")
  GRAPH_API_BASE_URL=$(prompt_value GRAPH_API_BASE_URL "Graph API base URL" "https://graph.microsoft.com/v1.0")

  # Write the .env file
  cat > "$ENV_DEST" <<EOF
PORT=${PORT}
MONGODB_URI=${MONGODB_URI}
API_KEY=${API_KEY}
AZURE_TENANT_ID=${AZURE_TENANT_ID}
AZURE_CLIENT_ID=${AZURE_CLIENT_ID}
AZURE_CLIENT_SECRET=${AZURE_CLIENT_SECRET}
GRAPH_API_BASE_URL=${GRAPH_API_BASE_URL}
NODE_ENV=production
EOF

  log_success ".env file written to ${ENV_DEST}"
fi

# Ensure the .env is not world-readable (it contains secrets)
chmod 600 "$ENV_DEST"
log_info "Permissions set to 600 on .env"

# ---------------------------------------------------------------------------
# Step 5: Build and deploy with Docker Compose
# ---------------------------------------------------------------------------
log_step "Step 5 of 5 — Building and deploying containers"

cd "$SCRIPT_DIR"

log_info "Running: ${DOCKER_COMPOSE_CMD} up --build -d"
if ! $DOCKER_COMPOSE_CMD up --build -d 2>&1 | while IFS= read -r line; do log_info "$line"; done; then
  log_error "${DOCKER_COMPOSE_CMD} up failed. Fetching container logs for diagnosis…"
  echo ""
  echo -e "${RED}--- Container Logs (app) ---${RESET}"
  $DOCKER_COMPOSE_CMD logs app 2>&1 || true
  echo ""
  echo -e "${RED}--- Container Logs (mongodb) ---${RESET}"
  $DOCKER_COMPOSE_CMD logs mongodb 2>&1 || true
  exit 1
fi

# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
log_step "Performing health check"

PORT_VALUE=$(grep -E '^PORT=' "$ENV_DEST" | cut -d'=' -f2 | tr -d '[:space:]')
PORT_VALUE="${PORT_VALUE:-3000}"
HEALTH_URL="http://localhost:${PORT_VALUE}/health"
MAX_RETRIES=12
RETRY_INTERVAL=5

log_info "Waiting for service to respond at ${HEALTH_URL}…"
for ((i=1; i<=MAX_RETRIES; i++)); do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${HEALTH_URL}" 2>/dev/null || echo "000")
  if [[ "$HTTP_CODE" == "200" ]]; then
    log_success "Service is healthy (HTTP 200)."
    break
  fi
  if [[ "$i" -eq "$MAX_RETRIES" ]]; then
    log_error "Service did not respond with HTTP 200 after $((MAX_RETRIES * RETRY_INTERVAL)) seconds."
    log_error "Last HTTP status: ${HTTP_CODE}"
    echo ""
    log_error "Dumping container logs for diagnosis:"
    echo ""
    echo -e "${RED}--- Container Logs (app) ---${RESET}"
    $DOCKER_COMPOSE_CMD logs app 2>&1 || true
    echo ""
    echo -e "${RED}--- Container Logs (mongodb) ---${RESET}"
    $DOCKER_COMPOSE_CMD logs mongodb 2>&1 || true
    exit 1
  fi
  log_info "Attempt ${i}/${MAX_RETRIES} — HTTP ${HTTP_CODE}. Retrying in ${RETRY_INTERVAL}s…"
  sleep "$RETRY_INTERVAL"
done

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo -e "${GREEN}${BOLD}============================================${RESET}"
echo -e "${GREEN}${BOLD}  Zebra BU Mapping Service is running!      ${RESET}"
echo -e "${GREEN}${BOLD}============================================${RESET}"
echo ""
echo -e "  ${BOLD}Health endpoint:${RESET}  ${HEALTH_URL}"
echo -e "  ${BOLD}API base URL:${RESET}     http://localhost:${PORT_VALUE}/api"
echo -e "  ${BOLD}Logs:${RESET}             ${DOCKER_COMPOSE_CMD} logs -f"
echo -e "  ${BOLD}Stop service:${RESET}     ${DOCKER_COMPOSE_CMD} down"
echo -e "  ${BOLD}Restart:${RESET}          ${DOCKER_COMPOSE_CMD} restart"
echo ""
log_info "To view live logs, run:  ${DOCKER_COMPOSE_CMD} logs -f"
