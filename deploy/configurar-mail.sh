#!/usr/bin/env bash
#
# Carga las claves de Resend (y el mail de contacto) en /etc/citify/app.env y
# reinicia Citify. Los valores se piden por teclado, sin eco: no quedan en el
# historial, ni en la lista de procesos, ni pasan por ningun chat.
#
#   ssh -t root@<vps> /home/citify/citify-aws/deploy/configurar-mail.sh
#
# Enter vacio en una pregunta = dejar ese valor como esta.
#
# Tambien acepta lineas KEY=valor por stdin (sin -t), para mandar las de un
# .env.local sin copiarlas a mano. Solo toma RESEND_API_KEY,
# OPENROUTER_API_KEY, OPENROUTER_MODEL,
# RESEND_WEBHOOK_SECRET y CONTACT_DESTINATION_EMAIL; el resto lo ignora.
set -euo pipefail

ENV_FILE="${ENV_FILE:-/etc/citify/app.env}"   # override solo para pruebas
[ "$(id -u)" = 0 ] || { echo "correr como root" >&2; exit 1; }
[ -f "$ENV_FILE" ] || { echo "falta $ENV_FILE" >&2; exit 1; }

estado() { grep -qE "^$1=.+" "$ENV_FILE" && echo "cargada" || echo "vacia"; }

# Reemplaza (o agrega) KEY=valor sin pasar el valor por sed: un secreto con
# '/', '&' o '|' romperia un s///.
poner() {
  local key="$1" value="$2" tmp
  tmp=$(mktemp)
  awk -v k="$key" -v v="$value" '
    BEGIN { hecho = 0 }
    index($0, k "=") == 1 { print k "=" v; hecho = 1; next }
    { print }
    END { if (!hecho) print k "=" v }
  ' "$ENV_FILE" > "$tmp"
  cat "$tmp" > "$ENV_FILE"   # cat > conserva dueño y permisos (root:citify 0640)
  rm -f "$tmp"
}

# Valida y guarda una clave. Solo acepta estas tres: cualquier otra linea que
# llegue por stdin se ignora (el .env.local trae mucho mas que esto).
guardar() {
  local key="$1" valor
  # Sin espacios, \r de Windows ni comillas alrededor.
  valor="$(printf '%s' "$2" | tr -d '[:space:]"'\''')"
  [ -z "$valor" ] && return 0
  case "$key" in
    RESEND_API_KEY)        [[ "$valor" == re_* ]]    || { echo "  $key no empieza con 're_', no se guardo" >&2; return 0; } ;;
    RESEND_WEBHOOK_SECRET) [[ "$valor" == whsec_* ]] || { echo "  $key no empieza con 'whsec_', no se guardo" >&2; return 0; } ;;
    CONTACT_DESTINATION_EMAIL)
      [[ "$valor" =~ ^[^@]+@[^@]+\.[^@]+$ ]] || { echo "  $key no parece un email, no se guardo" >&2; return 0; } ;;
    OPENROUTER_API_KEY)    [[ "$valor" == sk-or-* ]] || { echo "  $key no empieza con 'sk-or-', no se guardo" >&2; return 0; } ;;
    OPENROUTER_MODEL)      [[ "$valor" =~ ^[A-Za-z0-9._/:-]+$ ]] || { echo "  $key no parece un modelo, no se guardo" >&2; return 0; } ;;
    *) return 0 ;;
  esac
  poner "$key" "$valor"
  echo "  $key guardada"
}

if [ -t 0 ]; then
  # Modo interactivo: pregunta cada valor (los secretos sin eco).
  read -rs -p "RESEND_API_KEY (ahora: $(estado RESEND_API_KEY), Enter = no cambiar): " v; echo
  guardar RESEND_API_KEY "$v"
  read -rs -p "RESEND_WEBHOOK_SECRET (ahora: $(estado RESEND_WEBHOOK_SECRET), Enter = no cambiar): " v; echo
  guardar RESEND_WEBHOOK_SECRET "$v"
  read -r -p "CONTACT_DESTINATION_EMAIL (ahora: $(grep -E '^CONTACT_DESTINATION_EMAIL=' "$ENV_FILE" | cut -d= -f2-), Enter = no cambiar): " v
  guardar CONTACT_DESTINATION_EMAIL "$v"
else
  # Modo stdin: lineas KEY=valor, por ejemplo las de un .env.local:
  #   Select-String -Path .env.local -Pattern "^(RESEND_|OPENROUTER_)" | % Line | ssh root@<vps> <este script>
  while IFS= read -r linea || [ -n "$linea" ]; do
    linea="${linea%$'\r'}"
    [[ "$linea" =~ ^([A-Z_]+)=(.*)$ ]] || continue
    guardar "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
  done
fi

echo
[ -n "${NO_RESTART:-}" ] && { echo "(NO_RESTART: no se reinicia)"; exit 0; }
echo "reiniciando citify..."
systemctl restart citify
for i in $(seq 1 15); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:3040/login || true)
  [ "$code" = 200 ] && break
  sleep 2
done
[ "${code:-}" = 200 ] && echo "listo: citify responde (HTTP 200)" || { journalctl -u citify -n 20 --no-pager; exit 1; }
echo "RESEND_API_KEY: $(estado RESEND_API_KEY) · RESEND_WEBHOOK_SECRET: $(estado RESEND_WEBHOOK_SECRET) · OPENROUTER_API_KEY: $(estado OPENROUTER_API_KEY)"
