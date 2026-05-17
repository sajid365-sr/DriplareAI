import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { REGION_COOKIE, detectCountryFromHeaders } from '@/lib/core/region'

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)', 
  '/sign-up(.*)', 
  '/', 
  '/pricing', 
  '/tutorial', 
  '/api/webhooks/clerk(.*)', 
  '/api/webhooks/stripe(.*)', 
  '/api/payments/uddoktapay/webhook(.*)', 
  '/api/webhooks/meta(.*)',
  '/api/webhooks/n8n-facebook(.*)',  // n8n Facebook relay (Meta sends here)
  '/api/webhooks/whatsapp(.*)',      // Meta WhatsApp webhook verification + relay
  '/api/webhooks/n8n-whatsapp(.*)',  // n8n WhatsApp runtime status callbacks
  '/api/webhooks/instagram(.*)',      // Meta Instagram webhook verification + relay
  '/api/webhooks/n8n-instagram(.*)',  // n8n Instagram runtime status callbacks
  '/api/webhooks/n8n-callback(.*)',  // n8n calls this after sending reply
  '/dashboard/payment/success(.*)',  // পেমেন্ট সাকসেস পেজটি পাবলিক করা হলো
  '/api/test(.*)'
])

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect()
  }

  // --- Region detection ---
  const existingRegion = request.cookies.get(REGION_COOKIE)?.value

  if (!existingRegion) {
    const country = detectCountryFromHeaders(request.headers)
    // Bangladesh → bd, everything else → global
    // On local dev (no geo headers) → default to bd
    const region = country === null || country === 'BD' ? 'bd' : 'global'

    const response = NextResponse.next()
    response.cookies.set(REGION_COOKIE, region, {
      httpOnly: false, // client-side JS needs to read this
      maxAge: 60 * 60 * 24 * 90, // 90 days
      sameSite: 'lax',
      path: '/',
    })
    return response
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
