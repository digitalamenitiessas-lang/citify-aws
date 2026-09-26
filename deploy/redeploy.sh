#!/usr/bin/env bash
#
# Desplegar una version nueva de Citify en el VPS.
#
#   ssh root@<vps> '/home/citify/citify-aws/deploy/redeploy.sh [rama]'   (default: main)
#
# Hace: pull -> npm ci si cambiaron las dependencias -> build -> migraciones
# pendientes -> restart -> verificacion. Si el build falla NO reinicia: la
# version vieja sigue sirviendo.
#
# Corre como root (necesita systemctl). El build va con prioridad minima: el
# VPS tiene 1 nucleo compartido con Countrify y los bots.
set -Eeuo pipefail

BRANCH="${1:-main}"
APP_DIR=/home/citify/citify-aws
ENV_FILE=/etc/citify/app.env
SECRETS=/etc/citify/secrets.env
NODE_BIN=/opt/node22/bin
PORT=3040

die() { echo "ERROR: $1" >&2; exit 1; }
paso() { echo; echo "→ $1"; }
como_citify() { sudo -u citify -H env PATH="$NODE_BIN:$PATH" "$@"; }

[ "$(id -u)" = 0 ] || die "hay que correrlo como root (usa systemctl)"
[ -f "$ENV_FILE" ] || die "falta $ENV_FILE"
[ -f "$SECRETS" ] || die "falta $SECRETS"

cd "$APP_DIR"
export PATH="$NODE_BIN:$PATH"

paso "actualizando el codigo ($BRANCH)"
# next-env.d.ts lo regenera Next en cada build y ensucia el arbol.
como_citify git checkout -- next-env.d.ts 2>/dev/null || true
ANTES=$(git rev-parse HEAD)
como_citify git fetch -q origin "$BRANCH"
como_citify git checkout -q "$BRANCH"
como_citify git merge -q --ff-only "origin/$BRANCH"
DESPUES=$(git rev-parse HEAD)
if [ "$ANTES" = "$DESPUES" ]; then
  echo "  ya estaba al dia ($(git log --oneline -1))"
else
  echo "  $(git log --oneline "$ANTES..$DESPUES" | wc -l) commits nuevos -> $(git log --oneline -1)"
fi

paso "dependencias"
if [ ! -d node_modules ] || ! git diff --quiet "$ANTES" "$DESPUES" -- package-lock.json; then
  echo "  reinstalando"
  como_citify nice -n 19 ionice -c3 npm ci --no-audit --no-fund 2>&1 | tail -2
else
  echo "  sin cambios, se saltea npm ci"
fi

paso "compilando"
# Las NEXT_PUBLIC_* se congelan en el build: hay que tenerlas en el entorno.
# app.env es root:citify 0640, asi que el usuario citify lo puede leer.
como_citify bash -c "set -a; . '$ENV_FILE'; set +a; NEXT_TELEMETRY_DISABLED=1 nice -n 19 ionice -c3 npm run build" \
  > /tmp/citify-build.log 2>&1 \
  || { tail -30 /tmp/citify-build.log; die "el build fallo — el servicio NO se reinicio"; }
grep -E "Compiled successfully" /tmp/citify-build.log || true

paso "migraciones pendientes"
. "$SECRETS"
DB_HOST=127.0.0.1 DB_PORT=5432 DB_NAME=countrify DB_SSL=disable \
DB_USER=citify_admin DB_PASSWORD="$CITIFY_ADMIN_PW" \
  node scripts/db/migrate.mjs 2>&1 | tail -3

paso "reiniciando"
systemctl restart citify

paso "verificando"
code=""
for i in $(seq 1 15); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://127.0.0.1:$PORT/login" || true)
  [ "$code" = "200" ] && break
  sleep 2
done
[ "$code" = "200" ] || {
  journalctl -u citify -n 20 --no-pager
  die "la app no responde despues del reinicio (ultimo codigo: ${code:-sin respuesta})"
}

echo "  /login -> HTTP 200"
echo "  memoria: $(systemctl show citify -p MemoryCurrent --value | awk '{printf "%.0f MB",$1/1024/1024}')"
echo
echo "listo: $(git log --oneline -1)"
