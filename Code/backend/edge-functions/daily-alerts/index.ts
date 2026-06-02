// Supabase Edge Function: daily-alerts
// Schedule: 06:00 UTC daily via pg_cron
// Setup in Supabase dashboard: Database → Extensions → enable pg_cron
// Then run: SELECT cron.schedule('daily-alerts', '0 6 * * *', $$SELECT net.http_post(url:='<YOUR_FUNCTION_URL>', headers:='{"Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb)$$);

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async () => {
  const today = new Date().toISOString().split('T')[0]
  const twoDaysLater = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0]

  const { data: leases } = await supabase
    .from('leases')
    .select('id, asset_id, project_id, booked_by_id, start_date, end_date, assets(asset_tag, asset_type), projects(project_name, field_manager_id)')
    .eq('status', 'active')

  if (!leases) return new Response('no leases', { status: 200 })

  const notifications: object[] = []

  for (const lease of leases) {
    const asset = (lease.assets as { asset_tag: string; asset_type: string }) ?? {}
    const project = (lease.projects as { project_name: string; field_manager_id: string | null }) ?? {}
    const tag = asset.asset_tag ?? 'Asset'
    const projectName = project.project_name ?? 'your project'

    if (lease.start_date === today) {
      notifications.push({
        user_id: lease.booked_by_id,
        type: 'pickup_ready',
        title: 'Your lease starts today',
        message: `${tag} is ready for pickup for ${projectName}.`,
      })
    }

    if (lease.end_date === twoDaysLater) {
      notifications.push({
        user_id: lease.booked_by_id,
        type: 'expiry_reminder',
        title: 'Lease expiring soon',
        message: `${tag} lease for ${projectName} ends in 2 days (${lease.end_date}). Please arrange return.`,
      })
      if (project.field_manager_id && project.field_manager_id !== lease.booked_by_id) {
        notifications.push({
          user_id: project.field_manager_id,
          type: 'expiry_reminder',
          title: 'Lease expiring soon',
          message: `${tag} leased to ${projectName} expires in 2 days (${lease.end_date}).`,
        })
      }
    }

    if (lease.end_date < today) {
      notifications.push({
        user_id: lease.booked_by_id,
        type: 'overdue',
        title: 'Overdue lease',
        message: `${tag} for ${projectName} was due ${lease.end_date} and has not been returned.`,
      })
    }
  }

  if (notifications.length > 0) {
    await supabase.from('notifications').insert(notifications)
  }

  return new Response(JSON.stringify({ processed: leases.length, notifications: notifications.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
