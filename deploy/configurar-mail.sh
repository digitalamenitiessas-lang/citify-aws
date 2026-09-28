#!/usr/bin/env bash
#
# Carga las claves de Resend (y el mail de contacto) en /etc/citify/app.env y
# reinicia Citify. Los valores se piden por teclado, sin eco: no quedan en el
# historial, ni en la lista de procesos, ni pasan por ningun chat.
#
#   ssh -t root@<vps> /home/citify/citify-aws/deploy/configurar-mail.sh
#
# Enter vacio en una pregunta = dejar ese valor como esta.
set -euo pipefail

ENV_FILE=/etc/citify/app.env
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

pedir_secreto() {
  local key="$1" prefijo="$2" valor
  read -rs -p "$key (ahora: $(estado "$key"), Enter = no cambiar): " valor; echo
  [ -z "$valor" ] && return 0
  valor="$(echo -n "$valor" | tr -d '[:space:]')"
  if [[ "$valor" != "$prefijo"* ]]; then
    echo "  no empieza con '$prefijo', no se guardo" >&2
    return 0
  fi
  poner "$key" "$valor"
  echo "  $key guardada"
}

pedir_secreto RESEND_API_KEY re_
pedir_secreto RESEND_WEBHOOK_SECRET whsec_

read -r -p "CONTACT_DESTINATION_EMAIL (ahora: $(grep -E '^CONTACT_DESTINATION_EMAIL=' "$ENV_FILE" | cut -d= -f2-), Enter = no cambiar): " contacto
if [ -n "$contacto" ]; then
  if [[ "$contacto" =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]]; then
    poner CONTACT_DESTINATION_EMAIL "$contacto"
    echo "  CONTACT_DESTINATION_EMAIL guardada"
  else
    echo "  no parece un email, no se guardo" >&2
  fi
fi

echo
echo "reiniciando citify..."
systemctl restart citify
for i in $(seq 1 15); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:3040/login || true)
  [ "$code" = 200 ] && break
  sleep 2
done
[ "${code:-}" = 200 ] && echo "listo: citify responde (HTTP 200)" || { journalctl -u citify -n 20 --no-pager; exit 1; }
echo "RESEND_API_KEY: $(estado RESEND_API_KEY) · RESEND_WEBHOOK_SECRET: $(estado RESEND_WEBHOOK_SECRET)"
