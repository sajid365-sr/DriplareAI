import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local')
  }

  // Get the headers
  const headerPayload = await headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', {
      status: 400,
    })
  }

  // Get the body
  const payload = await req.json()
  const body = JSON.stringify(payload)

  const wh = new Webhook(WEBHOOK_SECRET)
  let evt: WebhookEvent

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Error verifying webhook:', err)
    return new Response('Error occured', {
      status: 400,
    })
  }

  const eventType = evt.type

  if (eventType === 'user.created' || eventType === 'user.updated') {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data
    const email = email_addresses[0]?.email_address
    const name = [first_name, last_name].filter(Boolean).join(' ') || 'User'

    if (email) {
      const user = await db.user.upsert({
        where: { userId: id },
        update: {
          email,
          name,
          picture: image_url,
        },
        create: {
          userId: id,
          email,
          name,
          picture: image_url,
        },
      })

      // Send Security Alert for user.updated
      if (eventType === 'user.updated') {
        const settings = (user.notificationSettings as any) || {};
        
        // In-app Notification
        if (settings.security_app !== false) {
          await db.notification.create({
            data: {
              userId: id,
              type: "security",
              title: "Account Updated",
              message: "Your profile or security settings have been updated recently.",
            }
          }).catch(console.error);
        }

        // Email Notification
        if (settings.security_email !== false) {
          const { sendMail, MailTemplates } = await import("@/lib/mail");
          await sendMail({
            to: email,
            subject: "Security Alert: Your account was updated - REMOVED AI",
            html: MailTemplates.securityAlert(
              name, 
              "Profile/Security Update", 
              "We noticed your account information was updated. If you didn't do this, please contact support."
            )
          }).catch(console.error);
        }
      }
    }
  }

  if (eventType === 'user.deleted') {
    const { id } = evt.data
    if (id) {
      await db.user.delete({
        where: { userId: id },
      }).catch(() => {})
    }
  }

  return new Response('', { status: 200 })
}
