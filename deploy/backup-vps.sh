#!/usr/bin/env bash
#
# Backup de Citify en el VPS: base + archivos + configuracion.
#
#   /home/citify/citify-aws/deploy/backup-vps.sh
#
# Corre por cron (deploy/cron.citify) a las 06:30 UTC, despues del backup de
# Countrify (06:15). El de Countrify hace pg_dump de la base ENTERA, o sea que
# ya incluye el schema citify; este agrega lo que es solo de Citify:
#
#   - db-citify.dump: pg_dump de los schemas citify y shared. Redundante con el
#     de Countrify a proposito: permite restaurar Citify sin tocar Countrify
#     (ver deploy/RESTORE.md).
#   - Los objetos de Garage de los buckets citify-public y citify-private.
#     citify.iadmin_payment_claims.document_object_key y
#     citify.iadmin_expense_documents.storage_path apuntan a objetos que viven
#     afuera de la base: sin ellos el dump deja filas huerfanas.
#   - /etc/citify y las units/sitios de Citify. Sin las credenciales, lo
#     restaurado no se puede abrir.
#
# CONTIENE SECRETOS. El directorio va 0700 root. Si se copia afuera, cifrarlo.
#
# Salidas: 0 todo bien · 1 algo fallo · 2 configuracion mal.
set -Eeuo pipefail
umask 077

BACKUP_DIR="${BACKUP_DIR:-/var/backups/citify}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
PG_DB="${PG_DB:-countrify}"
BUCKETS="${BUCKETS:-citify-public citify-private}"
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"

# Credenciales de Garage (key citify-app) y, opcional, el aviso por Telegram.
# rclone las toma de variables RCLONE_CONFIG_GARAGECITIFY_*: asi no se toca el
# rclone.conf de root, que usa el backup de Countrify.
[[ -f /etc/citify/backup.env ]] && source /etc/citify/backup.env

TS="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="$BACKUP_DIR/backup.log"

log() {
  local line="[$(date '+%Y-%m-%d %H:%M:%S%z')] $*"
  echo "$line"
  [[ -d "$BACKUP_DIR" ]] && echo "$line" >>"$LOG_FILE" || true
}

avisar() {
  [[ -n "$TELEGRAM_BOT_TOKEN" && -n "$TELEGRAM_CHAT_ID" ]] || return 0
  curl -sS --max-time 20 -o /dev/null \
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=[Citify] backup FALLO: $1" || true
}

die() {
  log "ERROR: $1"
  avisar "$1"
  exit "${2:-1}"
}

trap 'die "fallo inesperado en la linea $LINENO"' ERR

command -v pg_dump >/dev/null || die "falta pg_dump" 2
command -v rclone  >/dev/null || die "falta rclone" 2
[[ -n "${RCLONE_CONFIG_GARAGECITIFY_ACCESS_KEY_ID:-}" ]] || die "faltan las credenciales de Garage en /etc/citify/backup.env" 2

mkdir -p "$BACKUP_DIR" || die "no se pudo crear $BACKUP_DIR" 2
chmod 700 "$BACKUP_DIR"
DEST="$BACKUP_DIR/$TS"
mkdir -p "$DEST"
log "=== backup $TS ==="

# --- base ---
DUMP="$DEST/db-citify.dump"
log "base de datos (schemas citify + shared)..."
# cd /tmp: postgres no puede entrar al cwd de root y pg_dump avisa por eso.
(cd /tmp && sudo -u postgres pg_dump -Fc -d "$PG_DB" -n citify -n shared) > "$DUMP" || die "pg_dump fallo"
TABLAS=$(pg_restore -l "$DUMP" 2>/dev/null | grep -c "TABLE DATA" || true)
(( TABLAS > 0 )) || die "el dump no tiene tablas: esta corrupto"
log "  ok — $(numfmt --to=iec "$(stat -c%s "$DUMP")"), $TABLAS tablas"

# --- objetos ---
for B in $BUCKETS; do
  log "objetos de $B..."
  # Con el bucket vacio rclone no crea el directorio destino.
  mkdir -p "$DEST/objetos/$B"
  rclone sync "garagecitify:$B" "$DEST/objetos/$B" --create-empty-src-dirs \
    || die "rclone fallo copiando $B"
  N=$(find "$DEST/objetos/$B" -type f | wc -l)
  log "  ok — $N objetos"
  echo "$N" > "$DEST/objetos/$B.count"
done

# --- configuracion ---
log "configuracion..."
tar czf "$DEST/config.tar.gz" -C / \
  etc/citify etc/systemd/system/citify.service etc/caddy/citify.caddy etc/cron.d/citify \
  2>/dev/null || die "no se pudo empaquetar la configuracion"
log "  ok — $(numfmt --to=iec "$(stat -c%s "$DEST/config.tar.gz")")"

{
  echo "fecha: $(date -Iseconds)"
  echo "base: $PG_DB (schemas citify, shared), $TABLAS tablas"
  for B in $BUCKETS; do echo "bucket $B: $(cat "$DEST/objetos/$B.count") objetos"; done
  echo "commit: $(sudo -u citify git -C /home/citify/citify-aws rev-parse --short HEAD 2>/dev/null || echo '?')"
} > "$DEST/MANIFIESTO.txt"

# --- rotacion ---
BORRADOS=0
while IFS= read -r d; do
  rm -rf "$d"; BORRADOS=$((BORRADOS+1))
done < <(find "$BACKUP_DIR" -maxdepth 1 -type d -name '20*-*' -printf '%f\n' \
         | sort | head -n -"$RETENTION_DAYS" | sed "s|^|$BACKUP_DIR/|")
(( BORRADOS > 0 )) && log "rotacion: $BORRADOS backups viejos borrados"

log "=== listo — $(du -sh "$DEST" | cut -f1) en $DEST (quedan $(df -h "$BACKUP_DIR" | awk 'NR==2{print $4}') libres) ==="
trap - ERR
exit 0
