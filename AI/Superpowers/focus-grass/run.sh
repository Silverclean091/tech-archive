#!/usr/bin/env bash
# Focus & Grass 실행 스크립트 (macOS / Linux / Windows Git Bash)
#   ./run.sh [포트] [--no-open]
# 실제 서버는 serve.js 하나이고, 이 파일은 Node 확인 후 그것을 실행하는 얇은 래퍼입니다.
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 가 필요합니다 (18 이상). https://nodejs.org 에서 설치한 뒤 다시 실행하세요." >&2
  exit 1
fi
if ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 18 ? 0 : 1)'; then
  echo "Node.js 18 이상이 필요합니다. 현재 버전: $(node --version)" >&2
  exit 1
fi

exec node serve.js "$@"
