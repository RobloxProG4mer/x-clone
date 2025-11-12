#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
INSTANCE_FILE="$ROOT_DIR/src/instance.json"

echo "Tweetapus interactive setup"
echo

read -r -p "Instance name [tweetapus]: " INSTANCE_NAME
INSTANCE_NAME="${INSTANCE_NAME:-tweetapus}"

read -r -p "Environment (development/production) [development]: " ENV
ENV="${ENV:-development}"

read -r -p "Port [3000]: " PORT
PORT="${PORT:-3000}"

cat > "$INSTANCE_FILE" <<EOF
{
	"name": "${INSTANCE_NAME}",
	"env": "${ENV}",
	"port": ${PORT}
}
EOF

echo
echo "Wrote instance configuration to $INSTANCE_FILE"
echo "Instance: $INSTANCE_NAME"
echo "Environment: $ENV"
echo "Port: $PORT"

echo
echo "You can view the instance page at: http://localhost:${PORT} (when the server is running)"

exit 0
