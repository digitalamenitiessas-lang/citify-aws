// Setup de CloudWatch alarms sobre la reputación SES.
//
// Crea:
//   1. SNS topic `citify-ses-reputation-alerts` (si no existe) y subscribe
//      el email pasado por env.
//   2. Alarma `citify-ses-bounce-rate` sobre AWS/SES Reputation.BounceRate
//      con threshold 0.03 (3%). SES suspende sending arriba de 5% sostenido,
//      así que 3% nos da headroom para reaccionar.
//   3. Alarma `citify-ses-complaint-rate` sobre AWS/SES Reputation.ComplaintRate
//      con threshold 0.0005 (0.05%). SES suspende arriba de 0.1%.
//
// Uso:
//   ALERT_EMAIL=tu@mail.com node scripts/setup-ses-alarms.mjs
//
// Idempotente: si la alarma o el topic ya existen los re-aplica.

import { execSync } from 'node:child_process'

const REGION = process.env.AWS_REGION ?? 'us-east-1'
const ALERT_EMAIL = process.env.ALERT_EMAIL
const TOPIC_NAME = 'citify-ses-reputation-alerts'

if (!ALERT_EMAIL) {
  console.error('Falta ALERT_EMAIL=... en env')
  process.exit(1)
}

function aws(cmd) {
  return execSync(`aws ${cmd} --region ${REGION}`, { encoding: 'utf8' })
}

console.log(`Region: ${REGION}`)
console.log(`Alert email: ${ALERT_EMAIL}`)

// 1. SNS topic
console.log(`\n[1/3] Asegurando SNS topic ${TOPIC_NAME}...`)
const topicArn = aws(`sns create-topic --name ${TOPIC_NAME} --query TopicArn --output text`).trim()
console.log(`     ${topicArn}`)

// Subscribe email (idempotente: SNS dedup por endpoint).
console.log(`[1/3] Suscribiendo ${ALERT_EMAIL}...`)
try {
  aws(
    `sns subscribe --topic-arn ${topicArn} --protocol email --notification-endpoint ${ALERT_EMAIL}`,
  )
  console.log(`     OK — revisá tu mail y confirmá la subscripción.`)
} catch (e) {
  console.error('     Falló subscribe:', String(e.stderr ?? e.message))
}

// 2. Bounce rate alarm
console.log(`\n[2/3] Creando alarma citify-ses-bounce-rate...`)
const bounceCmd = [
  'cloudwatch put-metric-alarm',
  '--alarm-name citify-ses-bounce-rate',
  '--alarm-description "SES bounce rate > 3% (SES suspende >5%)"',
  '--namespace AWS/SES',
  '--metric-name Reputation.BounceRate',
  '--statistic Average',
  '--period 900', // 15 min
  '--evaluation-periods 1',
  '--threshold 0.03',
  '--comparison-operator GreaterThanOrEqualToThreshold',
  '--treat-missing-data notBreaching',
  `--alarm-actions ${topicArn}`,
  `--ok-actions ${topicArn}`,
].join(' ')
aws(bounceCmd)
console.log('     OK')

// 3. Complaint rate alarm
console.log(`\n[3/3] Creando alarma citify-ses-complaint-rate...`)
const complaintCmd = [
  'cloudwatch put-metric-alarm',
  '--alarm-name citify-ses-complaint-rate',
  '--alarm-description "SES complaint rate > 0.05% (SES suspende >0.1%)"',
  '--namespace AWS/SES',
  '--metric-name Reputation.ComplaintRate',
  '--statistic Average',
  '--period 900',
  '--evaluation-periods 1',
  '--threshold 0.0005',
  '--comparison-operator GreaterThanOrEqualToThreshold',
  '--treat-missing-data notBreaching',
  `--alarm-actions ${topicArn}`,
  `--ok-actions ${topicArn}`,
].join(' ')
aws(complaintCmd)
console.log('     OK')

console.log('\nListo. Confirmá la subscripción SNS desde tu mail.')
console.log('Verificá las alarmas en:')
console.log(`  https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#alarmsV2:`)
