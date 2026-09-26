#!/usr/bin/env bash
#
# Crea (o re-credencializa) un super_admin de Citify. La contraseña se pide por
# teclado, sin eco: no queda en el historial ni en la lista de procesos.
#
#   ssh -t root@<vps> /home/citify/citify-aws/deploy/crear-superadmin.sh <email>
#
# Pensado para correrse sin comillas desde cualquier terminal (PowerShell se
# come las comillas dobles anidadas de un comando ssh con variables inline).
set -euo pipefail

EMAIL="${1:-}"
APP_DIR=/home/citify/citify-aws
ENV_FILE=/etc/citify/app.env

[ -n "$EMAIL" ] || { echo "uso: $0 <email>" >&2; exit 2; }
[ -f "$ENV_FILE" ] || { echo "falta $ENV_FILE" >&2; exit 2; }

set -a; . "$ENV_FILE"; set +a

read -rs -p "Password para $EMAIL (minimo 8): " PASSWORD; echo
read -rs -p "Repetila: " CONFIRM; echo
[ "$PASSWORD" = "$CONFIRM" ] || { echo "no coinciden, no se creo nada" >&2; exit 1; }

cd "$APP_DIR"
SEED_SUPERADMIN_EMAIL="$EMAIL" SEED_SUPERADMIN_PASSWORD="$PASSWORD" \
  /opt/node22/bin/node scripts/db/seed-superadmin.mjs
