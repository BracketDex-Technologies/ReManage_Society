#!/usr/bin/env bash
set -euo pipefail

if [ -s "${HOME}/.nvm/nvm.sh" ]; then
  # Non-login WSL shells do not always load nvm from .bashrc.
  # shellcheck disable=SC1091
  . "${HOME}/.nvm/nvm.sh"
fi

run_step() {
  local name="$1"
  shift
  echo
  echo "==> ${name}"
  "$@"
}

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker CLI was not found in this WSL environment."
  echo "Install Docker Engine inside WSL, then retry: npm run phase2:live"
  exit 1
fi

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js/npm were not found in this WSL environment."
  echo "Install Node.js inside WSL, then retry: npm run phase2:live"
  exit 1
fi

node_path="$(command -v node)"
npm_path="$(command -v npm)"

case "${node_path}:${npm_path}" in
  /mnt/c/*|*:/mnt/c/*)
    echo "WSL is resolving Windows Node/npm:"
    echo "node: ${node_path}"
    echo "npm:  ${npm_path}"
    echo "Install Node.js inside WSL and ensure /usr/bin or ~/.nvm appears before /mnt/c paths."
    exit 1
    ;;
esac

run_step "Docker daemon readiness" docker info
run_step "Compose config validation" docker compose config
run_step "Start Phase 2 services" docker compose up -d postgres valkey minio keycloak
run_step "Service status" docker compose ps
run_step "Prisma schema validation" npm run db:validate
run_step "Prisma client generation" npm run db:generate
run_step "TypeScript verification" npm run typecheck
run_step "Automated tests" npm run test
run_step "Production build" npm run build

echo
echo "Phase 2 live validation completed."
