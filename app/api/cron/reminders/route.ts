import { sendReminder } from '@/lib/email'
import { authorizedCron } from '@/lib/auth'
import { errorResponse } from '@/lib/errors'
import { listRemindersDue, markReminderSent, releaseReminder } from '@/lib/orders'

// Pickup-morning nudge, one per order: each one is claimed before it is sent, so a
// crash between the two can only cost a reminder, never repeat one.
export async function GET(request: Request) {
  if (!authorizedCron(request)) return Response.json({ error: 'Not found' }, { status: 404 })

  try {
    const due = await listRemindersDue()
    let sent = 0
    let skipped = 0
    let failed = 0

    for (const order of due) {
      // One bad address or a race against another run must not stop the rest.
      try {
        if (!(await markReminderSent(order.id))) {
          skipped++
          continue
        }
        if (await sendReminder(order.orderCode)) {
          sent++
        } else {
          await releaseReminder(order.id)
          failed++
        }
      } catch (error) {
        await releaseReminder(order.id)
        failed++
        console.error('reminder_order_failed', { orderCode: order.orderCode, error })
      }
    }

    console.log('reminders', { checked: due.length, sent, skipped, failed })
    return Response.json({ checked: due.length, sent, skipped, failed })
  } catch (error) {
    return errorResponse(error, 'GET /api/cron/reminders')
  }
}
