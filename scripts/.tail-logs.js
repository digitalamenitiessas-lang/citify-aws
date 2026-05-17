const { CloudWatchLogsClient, FilterLogEventsCommand } = require('@aws-sdk/client-cloudwatch-logs')
async function main() {
  const taskId = process.argv[2]
  const minutesBack = Number(process.argv[3] || 30)
  const client = new CloudWatchLogsClient({ region: 'us-east-1' })
  const startTime = Date.now() - minutesBack * 60 * 1000
  const result = await client.send(new FilterLogEventsCommand({
    logGroupName: '/ecs/citify-prod-web',
    logStreamNames: [`ecs/citify-web/${taskId}`],
    startTime,
    limit: 500,
  }))
  for (const e of result.events || []) process.stdout.write((e.message || '') + '\n')
}
main().catch((e) => { console.error(e.message); process.exit(1) })
