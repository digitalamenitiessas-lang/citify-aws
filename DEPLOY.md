# Deploy a AWS — guía rápida

Infraestructura: **ECR** (imagen Docker) → **ECS Fargate** (servicio `citify-prod-service` en cluster `citify-prod-cluster`) detrás de un **ALB**, con **RDS Postgres** y **Cognito** en la misma cuenta. La región es siempre `us-east-1`.

Las IDs concretas (security groups, subnets, etc.) están al final del documento.

---

## 1. Prerequisitos (una sola vez por máquina)

1. **AWS CLI v2** configurado con un perfil que tenga permisos sobre la cuenta `351885857894`:
   ```
   aws configure
   aws sts get-caller-identity   # debe devolver tu identidad
   ```
2. **Docker Desktop** corriendo (necesario para build/push). Verificá con `docker info`.
3. **Node 22+** y `npm` (lo usa el build de Next.js).
4. **`.env.production` en la raíz** con al menos las dos variables que necesita el build de Next:
   ```
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
   OPENROUTER_MODEL=...
   ```
   (El resto de las env vars — DB creds, Cognito IDs, S3 — viven en la task definition de ECS, no en el repo.)
5. Si querés conectar a RDS desde tu máquina (para correr el script `apply-rds-schema.js` localmente), tu IP pública tiene que estar autorizada en el SG `sg-01eae542b6e8d44c2` puerto 5432:
   ```
   aws ec2 authorize-security-group-ingress --group-id sg-01eae542b6e8d44c2 \
     --protocol tcp --port 5432 --cidr <TU_IP>/32 --region us-east-1
   ```
   ⚠️ RDS está marcada como `PubliclyAccessible: false`, así que el endpoint resuelve a una IP privada de la VPC. **Desde fuera de la VPC no llegás aunque abras el SG.** Si necesitás conectividad local, primero hay que poner `PubliclyAccessible: true` (no requiere reboot) o usar un bastión / túnel. Por defecto preferí correr migraciones vía `ecs run-task` (sección 3.A).

---

## 2. Deploy de código (sin tocar la DB)

Tres pasos: **build → push → force-new-deployment**. La task definition apunta al tag `:3730a83` (sí, está hardcodeado y no se mueve — siempre pisamos ese tag).

```bash
# 0. Asegurate de estar en main con los cambios pusheados
git status
git push origin main          # si hay commits locales

# 1. Build local
npm ci                        # opcional; solo si tocaste package.json
npm run build                 # tiene que terminar sin errores

# 2. Login a ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin 351885857894.dkr.ecr.us-east-1.amazonaws.com

# 3. Build de la imagen Docker (mismo tag :3730a83 que usa la task def)
docker build \
  -t 351885857894.dkr.ecr.us-east-1.amazonaws.com/citify/citify-web-prod:3730a83 \
  --build-arg NEXT_PUBLIC_VAPID_PUBLIC_KEY=$(grep ^NEXT_PUBLIC_VAPID_PUBLIC_KEY .env.production | cut -d= -f2) \
  --build-arg OPENROUTER_MODEL=$(grep ^OPENROUTER_MODEL .env.production | cut -d= -f2) \
  .

# 4. Push
docker push 351885857894.dkr.ecr.us-east-1.amazonaws.com/citify/citify-web-prod:3730a83

# 5. Forzar re-deploy del servicio
aws ecs update-service \
  --cluster citify-prod-cluster \
  --service citify-prod-service \
  --force-new-deployment \
  --region us-east-1 \
  --query 'service.deployments[0].id' --output text

# 6. Esperar a que estabilice (~2-3 min)
aws ecs wait services-stable \
  --cluster citify-prod-cluster \
  --services citify-prod-service \
  --region us-east-1
echo "DEPLOY OK"

# 7. Verificar que el task corriendo tiene el digest que pusheamos
aws ecs describe-tasks \
  --cluster citify-prod-cluster \
  --tasks $(aws ecs list-tasks --cluster citify-prod-cluster --service-name citify-prod-service --region us-east-1 --query 'taskArns[0]' --output text) \
  --region us-east-1 \
  --query 'tasks[0].containers[0].imageDigest' --output text
```

Comparar el digest con el que devolvió `docker push` (la última línea, `... digest: sha256:XXXX`). Tienen que coincidir.

### Quick check post-deploy

```
curl -I https://citify.com.ar
```

Tiene que dar `HTTP/2 200`. Después abrir https://citify.com.ar en una ventana de incógnito y probar login con `vecino1@citify.com.ar` / `Test1234!`.

---

## 3. Migraciones de DB

Las migraciones SQL viven en `db/migrations/` (orden alfabético por fecha). Hay dos formas de aplicarlas: vía **ECS run-task** (recomendado — no necesita acceso directo a RDS) o vía **`scripts/apply-rds-schema.js`** (solo si tu IP llega al puerto 5432, ver sección 1.5).

### 3.A — Aplicar una migración nueva vía ECS run-task (recomendado)

Subimos el SQL a S3, lanzamos un task one-off del mismo container que ya tiene `pg` instalado y las credenciales en el env. **No requiere acceso directo a RDS.**

```bash
# 1. Subir el SQL a S3
MIGRATION=db/migrations/20260518_marketplace_multi_images.sql   # reemplazá por tu archivo
aws s3 cp "$MIGRATION" s3://citify-prod-assets/_tmp/migration.sql --region us-east-1

# 2. Crear el override que descarga el SQL y lo corre via pg
cat > scripts/.run-migration-override.json << 'EOF'
{
  "containerOverrides": [
    {
      "name": "citify-web",
      "command": [
        "node",
        "-e",
        "(async()=>{const{S3Client,GetObjectCommand}=require('@aws-sdk/client-s3');const{Pool}=require('pg');const s3=new S3Client({region:'us-east-1'});const r=await s3.send(new GetObjectCommand({Bucket:'citify-prod-assets',Key:'_tmp/migration.sql'}));const chunks=[];for await(const c of r.Body)chunks.push(c);const sql=Buffer.concat(chunks).toString('utf8');const pool=new Pool({host:process.env.DB_HOST,port:5432,database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD,ssl:{rejectUnauthorized:false}});await pool.query(sql);console.log('migration applied');await pool.end()})().catch(e=>{console.error(e);process.exit(1)})"
      ]
    }
  ]
}
EOF

# 3. Disparar el run-task
TASK_ARN=$(aws ecs run-task \
  --cluster citify-prod-cluster \
  --task-definition citify-prod-web:27 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-08be2fd4a6a2ac3d2,subnet-06b65507a4711bfc5,subnet-0126fd3fb0efdd889],securityGroups=[sg-0387fd2e1b5bfccd7],assignPublicIp=ENABLED}" \
  --overrides file://scripts/.run-migration-override.json \
  --region us-east-1 \
  --query 'tasks[0].taskArn' --output text)
TASK_ID=$(echo "$TASK_ARN" | awk -F/ '{print $NF}')
echo "task: $TASK_ID"

# 4. Esperar y chequear exit code
aws ecs wait tasks-stopped --cluster citify-prod-cluster --tasks $TASK_ID --region us-east-1
EXIT=$(aws ecs describe-tasks --cluster citify-prod-cluster --tasks $TASK_ID --region us-east-1 --query 'tasks[0].containers[0].exitCode' --output text)
echo "exit: $EXIT"   # 0 = OK

# 5. Logs (sirve para ver el "migration applied" o el error)
PYTHONUTF8=1 MSYS_NO_PATHCONV=1 aws logs tail /ecs/citify-prod-web --since 3m --region us-east-1 --format short | tail -20
```

### 3.B — Aplicar TODAS las migraciones desde tu máquina

Solo si pudiste resolver acceso a RDS (sección 1.5).

```bash
# Necesitás las credenciales de RDS en variables de entorno o en C:\tmp\citify-rds-credentials.txt
node scripts/apply-rds-schema.js
```

El script:
- Lee todos los archivos `*.sql` de `db/migrations/` en orden alfabético.
- Los corre **en una sola transacción** (rollback si alguno falla).
- Genera/actualiza `scripts/generated-rds-schema.sql` (snapshot consolidado del schema).

### 3.C — Verificar que la migración quedó aplicada

Mismo patrón que la migración, pero con un script de read-only:

```bash
cat > scripts/.check.js << 'EOF'
/* eslint-disable */
const { Pool } = require('pg')
async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST, port: 5432,
    database: process.env.DB_NAME, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, ssl: { rejectUnauthorized: false },
  })
  // ⚠️ Ajustá esta query al check que necesites:
  const r = await pool.query(`select column_name from information_schema.columns where table_name='marketplace_items'`)
  console.log(r.rows)
  await pool.end()
}
module.exports = main
EOF

# El override scripts/.run-task-override.json ya está commiteado en el repo
# (descarga _tmp/seed.js de S3 y lo ejecuta).
aws s3 cp scripts/.check.js s3://citify-prod-assets/_tmp/seed.js --region us-east-1

aws ecs run-task --cluster citify-prod-cluster --task-definition citify-prod-web:27 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-08be2fd4a6a2ac3d2,subnet-06b65507a4711bfc5,subnet-0126fd3fb0efdd889],securityGroups=[sg-0387fd2e1b5bfccd7],assignPublicIp=ENABLED}" \
  --overrides file://scripts/.run-task-override.json --region us-east-1
```

---

## 4. Cambiar env vars en producción

Las env vars de runtime (DB creds, S3, Cognito, etc.) viven en la **task definition**. Para cambiar una:

```bash
# 1. Bajar la task def actual
aws ecs describe-task-definition --task-definition citify-prod-web:27 --region us-east-1 \
  --query 'taskDefinition' > /tmp/taskdef.json

# 2. Editar /tmp/taskdef.json (modificar containerDefinitions[0].environment)
#    y eliminar campos read-only:
#    .taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy

# 3. Registrar nueva revisión
NEW_REV=$(aws ecs register-task-definition --cli-input-json file:///tmp/taskdef.json \
  --region us-east-1 --query 'taskDefinition.revision' --output text)
echo "nueva revisión: $NEW_REV"

# 4. Apuntar el servicio a la nueva revisión
aws ecs update-service --cluster citify-prod-cluster --service citify-prod-service \
  --task-definition "citify-prod-web:$NEW_REV" --region us-east-1
aws ecs wait services-stable --cluster citify-prod-cluster --services citify-prod-service --region us-east-1
```

---

## 5. Logs y debugging

```bash
# Últimos 10 min de logs
PYTHONUTF8=1 MSYS_NO_PATHCONV=1 aws logs tail /ecs/citify-prod-web --since 10m --region us-east-1 --format short

# Filtrar por palabra
PYTHONUTF8=1 MSYS_NO_PATHCONV=1 aws logs filter-log-events \
  --log-group-name /ecs/citify-prod-web \
  --start-time $(( ($(date +%s) - 600) * 1000 )) \
  --filter-pattern "error" \
  --region us-east-1 --output text | head -30

# Estado del servicio + tasks corriendo
aws ecs describe-services --cluster citify-prod-cluster --services citify-prod-service \
  --region us-east-1 --query 'services[0].{desired:desiredCount,running:runningCount,deployments:deployments[].{status:status,rolloutState:rolloutState,running:runningCount}}'
```

> **Nota Git Bash en Windows:** sin `MSYS_NO_PATHCONV=1` Git Bash convierte `/ecs/citify-prod-web` a una ruta de Windows y `aws logs` falla. Sin `PYTHONUTF8=1` la salida revienta cuando hay un caracter raro (`⨯`, tildes).

---

## 6. Rollback rápido

Si un deploy rompió algo y querés volver a la versión anterior:

```bash
# Listar las imágenes en ECR ordenadas por fecha
aws ecr describe-images --repository-name citify/citify-web-prod --region us-east-1 \
  --query 'sort_by(imageDetails,&imagePushedAt)[*].{tag:imageTags|[0],pushedAt:imagePushedAt,digest:imageDigest}' \
  --output table

# Cada push deja un imageDigest. Para rollback, retageá un digest anterior como :3730a83 y forzá deploy:
PREV_DIGEST=sha256:XXXXXX   # copiar del listado de arriba
docker pull 351885857894.dkr.ecr.us-east-1.amazonaws.com/citify/citify-web-prod@${PREV_DIGEST}
docker tag  351885857894.dkr.ecr.us-east-1.amazonaws.com/citify/citify-web-prod@${PREV_DIGEST} \
            351885857894.dkr.ecr.us-east-1.amazonaws.com/citify/citify-web-prod:3730a83
docker push 351885857894.dkr.ecr.us-east-1.amazonaws.com/citify/citify-web-prod:3730a83

aws ecs update-service --cluster citify-prod-cluster --service citify-prod-service \
  --force-new-deployment --region us-east-1
```

Las migraciones de DB **no se revierten automáticamente** — escribilas siempre con `ADD COLUMN IF NOT EXISTS` / `CREATE ... IF NOT EXISTS` para que sean idempotentes.

---

## 7. Recursos AWS — referencia rápida

| Cosa | ID |
|---|---|
| Cuenta AWS | `351885857894` |
| Región | `us-east-1` |
| ECR repo | `citify/citify-web-prod` |
| ECS cluster | `citify-prod-cluster` |
| ECS service | `citify-prod-service` |
| Task definition family | `citify-prod-web` (revisión actual: 27) |
| RDS instance | `citify-prod-db` (endpoint `citify-prod-db.cyhi4wiiax9v.us-east-1.rds.amazonaws.com`) |
| RDS DB | `citify` (user `citify_admin`) |
| RDS security group | `sg-01eae542b6e8d44c2` (solo deja entrar a `sg-0387fd2e1b5bfccd7`) |
| Cognito User Pool | `us-east-1_qcmuRiMh1` |
| Cognito Client | `2pqp4rei9p3971diarhiht9lnu` |
| S3 bucket | `citify-prod-assets` (público en `public/*`, privado en `private/*` y `_tmp/*`) |
| ALB DNS | `citify-prod-alb-522648696.us-east-1.elb.amazonaws.com` |
| Dominios | `citify.com.ar`, `www.citify.com.ar` (cert ACM con SAN) |
| ECS subnets | `subnet-08be2fd4a6a2ac3d2`, `subnet-06b65507a4711bfc5`, `subnet-0126fd3fb0efdd889` |
| ECS security group | `sg-0387fd2e1b5bfccd7` |
| Log group | `/ecs/citify-prod-web` |

---

## 8. Gotchas conocidos

- **El tag de la task definition es `:3730a83`, no `:latest`.** Si pusheás `:latest` y forzás deploy, no pasa nada (ECS sigue tirando del tag pinneado). Siempre pisar `:3730a83`.
- **CORS del bucket** está hardcodeado para `https://citify.com.ar`, `https://www.citify.com.ar`, ALB y `localhost:3000`. Si vas a deployar a otro dominio (VPS, staging) hay que agregarlo:
  ```
  aws s3api put-bucket-cors --bucket citify-prod-assets --cors-configuration file://scripts/.cors.json --region us-east-1
  ```
- **`pnpm-lock.yaml` no existe** — el proyecto usa `npm`. Si alguien lo recrea, borrarlo.
- **Multi-arch images**: el `docker push` muestra un digest (manifest list), pero `aws ecs describe-tasks` reporta el digest del manifest específico de plataforma (linux/amd64). Son distintos pero la imagen es la misma.
- **RDS no es publicly accessible.** Para conectar con `psql` o un cliente local necesitás abrirla o usar un bastión. Por defecto preferí `ecs run-task` para todo lo que sea DB.
- **`auth.uid()` en SQL** está redefinido para leer la GUC `app.current_profile_id`. Si una query necesita respetar RLS por usuario, usar `pgQueryAsProfile(profileId, ...)` (de `lib/db/postgres.ts`) en vez de `pgQuery`. El owner de las tablas (`citify_admin`) bypasea RLS, así que la mayoría de queries de servidor andan sin GUC, pero algunas (típicamente los UPDATEs que toca el dueño de una entidad) necesitan el contexto.
- **Service worker (`public/sw.js`)** se cachea agresivamente en browser. Después de cambios al PWA, los users ven la versión vieja hasta que cierran todas las tabs. Para forzar refresco: cambiar el `cacheName`/version del SW.

---

## 9. Checklist típico para un deploy con migración

```
[ ] git pull en main
[ ] Migración SQL en db/migrations/YYYYMMDD_descripcion.sql (idempotente)
[ ] npm run build pasa localmente
[ ] git push origin main
[ ] Aplicar migración (sección 3.A) — verificar exit code 0
[ ] Verificar el cambio en DB (sección 3.C)
[ ] Build + push + deploy (sección 2)
[ ] aws ecs wait services-stable
[ ] Verificar digest del task corriendo
[ ] curl -I https://citify.com.ar  → 200
[ ] Login + smoke test manual de la feature nueva
[ ] Si algo falla → rollback (sección 6) + revisar logs (sección 5)
```
