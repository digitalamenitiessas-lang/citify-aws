#!/usr/bin/env bash
#
# Crea el schema de Citify dentro de la base compartida con Countrify.
# Idempotente. Correr como superusuario de Postgres (en el VPS: sudo -u postgres).
#
#   scripts/db/setup.sh [nombre_de_base]      (default: countrify)
#
# Variables:
#   PGHOST PGPORT PGUSER PGPASSWORD  conexion (defaults de psql si no estan)
#   CITIFY_ADMIN_PW                  password del rol citify_admin
#   CITIFY_APP_PW                    password del rol citify_app
#
# Requiere que la base ya exista con el schema shared de Countrify (dueño
# countrify_admin). Ver deploy/MULTI-PRODUCTO.md en countrify-aws.
#
# Orden y por que:
#   00_roles          roles del cluster + pgcrypto (necesita superusuario)
#   02_shared_access  como countrify_admin (dueño de shared): usage/DML/references
#                     para los roles de Citify. ANTES de las migraciones, porque
#                     crean FKs hacia shared.businesses y shared.promotions.
#   01_schema         como citify_admin: schema citify + citify.uid()
#   migrations/       como citify_admin, en orden alfabetico
#   03_grants         como citify_admin, al final para cubrir lo que crearon
#                     las migraciones
set -euo pipefail

# Orden de las migraciones por code point, igual que migrate.mjs (Array.sort).
# Con un locale tipo en_US.UTF-8 el glob de bash ignora el '_' al ordenar y
# 20260416b_building_complaints queda ANTES que 20260416_consorcio_multi_building,
# que define una funcion que la primera usa.
export LC_ALL=C

DB="${1:-countrify}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BOOT="$ROOT/db/bootstrap"

ADMIN_PW="${CITIFY_ADMIN_PW:-}"
APP_PW="${CITIFY_APP_PW:-}"

if [[ -z "$ADMIN_PW" || -z "$APP_PW" ]]; then
  echo "error: faltan CITIFY_ADMIN_PW y/o CITIFY_APP_PW" >&2
  echo "generar una con: openssl rand -base64 24" >&2
  exit 1
fi

if [[ ! -f "$BOOT/01_schema.sql" ]]; then
  echo "error: falta $BOOT/01_schema.sql — corre primero: node scripts/db/build-schema.mjs" >&2
  exit 1
fi

if [[ "$(psql -At -d "$DB" -c "select to_regnamespace('shared') is not null")" != "t" ]]; then
  echo "error: la base '$DB' no tiene el schema shared. Citify va sobre la base de Countrify." >&2
  exit 1
fi

# Escapa comillas simples para pasar la password como literal SQL.
sql_literal() { printf "'%s'" "${1//\'/\'\'}"; }

run() { psql -q -v ON_ERROR_STOP=1 -d "$DB" "$@"; }

# El SET ROLE y el -f comparten sesion, asi que todo lo que cree el archivo
# nace con ese rol de dueño. Sin esto quedaria owned by postgres y citify_admin
# no podria correr la primera migracion futura.
run_as() { local role="$1"; shift; psql -q -v ON_ERROR_STOP=1 -d "$DB" -c "set role $role" -c 'set search_path = citify, shared, public' "$@"; }

echo "→ roles"
run -v db="$DB" \
    -v admin_pw="$(sql_literal "$ADMIN_PW")" \
    -v app_pw="$(sql_literal "$APP_PW")" \
    -f "$BOOT/00_roles.sql"

echo "→ acceso a shared (como countrify_admin)"
run_as countrify_admin -f "$BOOT/02_shared_access.sql"

echo "→ schema citify"
run_as citify_admin -f "$BOOT/01_schema.sql"

echo "→ migraciones"
for f in "$BOOT"/migrations/*.sql; do
  echo "   $(basename "$f")"
  run_as citify_admin -f "$f"
done

echo "→ grants"
run_as citify_admin -f "$BOOT/03_grants.sql"

echo
echo "listo. base '$DB', schema citify:"
psql -At -d "$DB" \
  -c "select '  tablas:    '||count(*) from pg_tables where schemaname='citify';" \
  -c "select '  funciones: '||count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='citify';" \
  -c "select '  dueño:     '||pg_get_userbyid(nspowner) from pg_namespace where nspname='citify';"
echo
echo "siguiente paso: registrar las migraciones en la tabla de control:"
echo "  DB_ADMIN_USER=citify_admin DB_ADMIN_PASSWORD=... node scripts/db/migrate.mjs --baseline"
