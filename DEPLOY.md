# Citify en el VPS

Citify corre en el VPS de Hostinger `2.25.185.242` (Ubuntu 24.04, 1 núcleo,
3.8 GB), **compartido** con Countrify y con ~15 bots y servicios que no se
pueden romper. Todo lo de acá está pensado para convivir con eso.

AWS ya no se usa (la cuenta se borró: Cognito, RDS, S3, SES, ECS).

## Qué hay y dónde

| Pieza | Dónde | Notas |
|---|---|---|
| Código | `/home/citify/citify-aws` (usuario `citify`) | `git pull` desde GitHub (`main`) |
| Servicio | `citify.service` → `next start` en `127.0.0.1:3040` | `Nice=10`, `MemoryMax=1G` (ver `deploy/citify.service`) |
| Entorno | `/etc/citify/app.env` (root:citify 0640) | plantilla: `.env.example` |
| Secretos de roles | `/etc/citify/secrets.env` (root 0600) | `CITIFY_ADMIN_PW`, `CITIFY_APP_PW` |
| Base | Postgres 17 local, base **`countrify`**, schema **`citify`** | compartida con Countrify, ver abajo |
| Archivos | Garage (S3), buckets `citify-public` / `citify-private`, key `citify-app` | credenciales en `/etc/citify/garage.env` |
| HTTPS | Caddy nativo, `/etc/caddy/citify.caddy` importado desde `/etc/caddy/Caddyfile` | `deploy/citify.caddy` |
| Cron | `/etc/cron.d/citify` | intereses por mora, recordatorios, backup |
| Backups | `/var/backups/citify/<fecha>` (14 días) | `deploy/backup-vps.sh` |
| Node | `/opt/node22/bin` | el mismo que usa Countrify |

### La base es compartida con Countrify

Una base (`countrify`), tres schemas:

| Schema | Contenido | Dueño |
|---|---|---|
| `shared` | `businesses`, `promotions` (las mismas filas para los dos productos) | `countrify_admin` |
| `countrify` | tablas de Countrify | `countrify_admin` |
| `citify` | tablas de Citify | `citify_admin` |

`citify_app` (runtime, solo DML) tiene acceso a `citify` y `shared`, y nada
sobre `countrify`. Las migraciones corren como `citify_admin`. El
`search_path` de la app es `citify, shared, public` (`DB_SCHEMA`).

Detalle y motivos: `deploy/MULTI-PRODUCTO.md` en el repo `countrify-aws`.

### Dominios

| Nombre | Para qué |
|---|---|
| `citify.com.ar` | la app |
| `www.citify.com.ar` | redirige a `citify.com.ar` |
| `s3.citify.com.ar` | API S3 de Garage: subidas con URL prefirmada. **Tiene que coincidir con `S3_ENDPOINT`** o las subidas fallan con `SignatureDoesNotMatch` |
| `archivos.citify.com.ar` | lectura pública de `citify-public` (logos, promos, marketplace) |

Los cuatro son registros A a `2.25.185.242` en Cloudflare, en **DNS only**
(nube gris). En modo proxied, Caddy ve la IP de Cloudflare y el rate limit de
login deja de identificar al visitante.

---

## Desplegar una versión nueva

```bash
ssh root@2.25.185.242 '/home/citify/citify-aws/deploy/redeploy.sh'
```

Hace pull de `main` → `npm ci` si cambió el lock → build con prioridad mínima
→ migraciones pendientes → restart → verifica `/login`. Si el build falla, no
reinicia y la versión anterior sigue sirviendo.

## Migraciones

Se escriben en `db/migrations/` (schema `citify.` o `public.`, el generador lo
reescribe) y se regeneran con:

```bash
node scripts/db/build-schema.mjs     # db/migrations -> db/bootstrap/migrations
```

Se commitean las dos cosas. `redeploy.sh` aplica las pendientes con
`scripts/db/migrate.mjs` (tabla de control `citify.schema_migrations`). Una
migración aplicada no se edita: se escribe otra.

## Crear o re-credencializar un super_admin

La contraseña se tipea en el servidor (no queda en el historial ni en la lista
de procesos). Mínimo 8 caracteres.

```bash
ssh root@2.25.185.242
cd /home/citify/citify-aws
set -a; . /etc/citify/app.env; set +a
read -rs -p "Password: " SEED_SUPERADMIN_PASSWORD; echo; export SEED_SUPERADMIN_PASSWORD
SEED_SUPERADMIN_EMAIL=superadmin@citify.com /opt/node22/bin/node scripts/db/seed-superadmin.mjs
unset SEED_SUPERADMIN_PASSWORD
```

Es idempotente: si el email existe, le reescribe la contraseña y lo deja como
`super_admin`.

## Operación diaria

```bash
systemctl status citify
journalctl -u citify -f                      # logs de la app
journalctl -u caddy -f | grep citify.com.ar  # accesos
tail -f /var/log/citify-cron.log /var/log/citify-backup.log
```

## Backup

Dos capas:

1. **Countrify** (`/etc/cron.d/countrify`, 06:15 UTC) hace `pg_dump` de la
   base entera, o sea que incluye el schema `citify`.
2. **Citify** (`/etc/cron.d/citify`, 06:30 UTC): `db-citify.dump` (schemas
   `citify` + `shared`), los objetos de los dos buckets y `config.tar.gz`
   (`/etc/citify`, unit, sitio de Caddy, cron).

Contiene secretos: `/var/backups/citify` es 0700 root.

## Restore

**Probar siempre primero sobre una base descartable.** `pg_restore` como
postgres no puede leer archivos de root: pasarle el dump por stdin.

### Recuperar datos puntuales (se borró algo)

```bash
cd /tmp
sudo -u postgres createdb revision
cat /var/backups/citify/<fecha>/db-citify.dump | sudo -u postgres pg_restore -d revision --no-owner --no-privileges
# consultar revision.citify.* y copiar lo que haga falta a la base real
sudo -u postgres dropdb revision
```

### Restaurar el schema citify entero (sin tocar Countrify)

```bash
systemctl stop citify
cd /tmp
sudo -u postgres psql -d countrify -c 'drop schema citify cascade'
# pg_restore -n no recrea el schema: hay que crearlo antes.
sudo -u postgres psql -d countrify -c 'create schema citify authorization citify_admin'
cat /var/backups/citify/<fecha>/db-citify.dump \
  | sudo -u postgres pg_restore -d countrify --no-owner --no-privileges -n citify
# devolverle la propiedad a citify_admin y los permisos a citify_app
sudo -u postgres psql -d countrify <<'SQL'
alter schema citify owner to citify_admin;
do $$ declare r record; begin
  for r in select tablename from pg_tables where schemaname = 'citify' loop
    execute format('alter table citify.%I owner to citify_admin', r.tablename); end loop;
  for r in select sequencename from pg_sequences where schemaname = 'citify' loop
    execute format('alter sequence citify.%I owner to citify_admin', r.sequencename); end loop;
  for r in select p.oid::regprocedure as f from pg_proc p where p.pronamespace = 'citify'::regnamespace loop
    execute format('alter routine %s owner to citify_admin', r.f); end loop;
  for r in select t.typname from pg_type t where t.typnamespace = 'citify'::regnamespace and t.typtype = 'e' loop
    execute format('alter type citify.%I owner to citify_admin', r.typname); end loop;
end $$;
SQL
sudo -u postgres psql -d countrify -c 'set role citify_admin' -f /home/citify/citify-aws/db/bootstrap/03_grants.sql
systemctl start citify
```

Con `-n citify`, `pg_restore` corta la lectura apenas termina lo suyo y `cat`
puede quejarse de *broken pipe*: es inofensivo.

`shared` NO se restaura por este camino: es de los dos productos. Si hace
falta, se recupera fila por fila desde la base `revision`.

### Archivos

```bash
set -a; . /etc/citify/backup.env; set +a
rclone copy /var/backups/citify/<fecha>/objetos/citify-private garagecitify:citify-private
rclone copy /var/backups/citify/<fecha>/objetos/citify-public  garagecitify:citify-public
```

## Montar desde cero (lo que se hizo el 2026-09-26)

1. `useradd --create-home citify`, clonar el repo en `/home/citify/citify-aws`, `npm ci`.
2. `/etc/citify/secrets.env` con `CITIFY_ADMIN_PW` / `CITIFY_APP_PW` (`openssl rand -hex 24`).
3. Schema sobre la base compartida (requiere que exista `shared`, de Countrify):
   ```bash
   . /etc/citify/secrets.env
   sudo -u postgres env CITIFY_ADMIN_PW=$CITIFY_ADMIN_PW CITIFY_APP_PW=$CITIFY_APP_PW \
     bash /home/citify/citify-aws/scripts/db/setup.sh countrify
   DB_HOST=127.0.0.1 DB_NAME=countrify DB_SSL=disable DB_USER=citify_admin DB_PASSWORD=$CITIFY_ADMIN_PW \
     node scripts/db/migrate.mjs --baseline
   ```
4. Garage: `garage key create citify-app`, `garage bucket create citify-public|citify-private`,
   `garage bucket allow --read --write --owner <bucket> --key citify-app`,
   `garage bucket website --allow citify-public`, y el CORS con
   `scripts/storage/set-cors.mjs` contra `http://127.0.0.1:3900`.
5. `/etc/citify/app.env` (plantilla `.env.example`), `backup.env`, `cron.curlrc`.
6. Build (`deploy/redeploy.sh` lo hace), `deploy/citify.service` →
   `/etc/systemd/system/`, `systemctl enable --now citify`.
7. `deploy/cron.citify` → `/etc/cron.d/citify`.
8. DNS en Cloudflare (4 registros, DNS only) y, **recién cuando resuelvan**,
   `deploy/citify.caddy` → `/etc/caddy/`, `import /etc/caddy/citify.caddy`
   al final del `Caddyfile`, `caddy validate` y `systemctl reload caddy`.

## Troubleshooting

- **Subir un archivo da 403 / `SignatureDoesNotMatch`:** `S3_ENDPOINT` no es
  exactamente `https://s3.citify.com.ar`, o falta el CORS del bucket.
- **Cambié una `NEXT_PUBLIC_*` y no se nota:** se congelan en el build; correr
  `redeploy.sh`.
- **`migrate.mjs` aborta por hash distinto:** alguien editó una migración ya
  aplicada. Escribir una nueva.
- **Los mails no salen:** `RESEND_API_KEY` vacía o el dominio no verificado en
  Resend (`journalctl -u citify | grep email/send`).
- **El VPS se queda sin memoria:** `MemoryMax=1G` mata a Citify antes que a los
  bots; revisar `journalctl -u citify` y bajar `DB_POOL_MAX`.
