import fs from 'node:fs'
import { execSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'

const map = JSON.parse(fs.readFileSync('C:/tmp/citify-secrets-map.json', 'utf8'))
const pairs = [
  ['citify/prod/db-password', map.DB_PASSWORD],
  ['citify/prod/app-session-secret', map.APP_SESSION_SECRET],
  ['citify/prod/vapid-private-key', map.VAPID_PRIVATE_KEY],
  ['citify/prod/openrouter-api-key', map.OPENROUTER_API_KEY],
]

const out = {}
for (const [name, value] of pairs) {
  const tmp = path.join(os.tmpdir(), `secret-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`)
  fs.writeFileSync(tmp, value)
  try {
    const arn = execSync(
      `aws secretsmanager create-secret --name "${name}" --description "Citify prod" --secret-string file://${tmp.replace(/\\/g, '/')} --region us-east-1 --query ARN --output text`,
      { encoding: 'utf8' },
    ).trim()
    out[name] = arn
    console.log(`  ${name} -> ${arn}`)
  } catch (e) {
    const msg = String(e.stderr ?? e.message)
    if (msg.includes('ResourceExistsException')) {
      const arn = execSync(
        `aws secretsmanager describe-secret --secret-id "${name}" --region us-east-1 --query ARN --output text`,
        { encoding: 'utf8' },
      ).trim()
      execSync(
        `aws secretsmanager put-secret-value --secret-id "${name}" --secret-string file://${tmp.replace(/\\/g, '/')} --region us-east-1`,
        { stdio: 'pipe' },
      )
      out[name] = arn
      console.log(`  ${name} (updated) -> ${arn}`)
    } else {
      console.error(`FAIL ${name}: ${msg}`)
      throw e
    }
  } finally {
    fs.unlinkSync(tmp)
  }
}
fs.writeFileSync('C:/tmp/citify-secrets-arns.json', JSON.stringify(out, null, 2))
console.log('\nARNs:', JSON.stringify(out, null, 2))
