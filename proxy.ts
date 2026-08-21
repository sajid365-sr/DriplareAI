import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { REGION_COOKIE, detectCountryFromHeaders } from '@/lib/core/region'
import { isClerkAdminFromClaims, getExplicitClerkRole } from '@/lib/core/admin-rbac'

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)', 
  '/sign-up(.*)', 
  '/', 
  '/pricing', 
  '/tutorial', 
  '/blog(.*)',
  '/Assets/(.*)',
  '/assets/(.*)',
  '/api/webhooks/clerk(.*)', 
  '/api/webhooks/stripe(.*)', 
  '/api/payments/uddoktapay/webhook(.*)', 
  '/api/payments/uddoktapay/cancel(.*)', 
  '/api/webhooks/meta(.*)',
  '/api/webhooks/n8n-facebook(.*)',  // n8n Facebook relay (Meta sends here)
  '/api/webhooks/whatsapp(.*)',      // Meta WhatsApp webhook verification + relay
  '/api/webhooks/n8n-whatsapp(.*)',  // n8n WhatsApp runtime status callbacks
  '/api/webhooks/instagram(.*)',      // Meta Instagram webhook verification + relay
  '/api/integrations/instagram/oauth/callback(.*)', // Instagram Login OAuth return (no Clerk on redirect)
  '/api/webhooks/n8n-instagram(.*)',  // n8n Instagram runtime status callbacks
  '/api/webhooks/n8n-callback(.*)',  // n8n calls this after sending reply
  '/dashboard/payment/success(.*)',  // পেমেন্ট সাকসেস পেজটি পাবলিক করা হলো
  '/api/contact(.*)',                // Public contact / demo form submissions
  '/api/test(.*)'
])

const isAdminRoute = createRouteMatcher([
  '/admin(.*)',
  '/api/admin(.*)',
])

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect()
  }

  // Block non-admins when Clerk metadata explicitly denies admin access.
  // Prisma User.role is verified server-side in admin layout via requireAdmin().
  if (isAdminRoute(request)) {
    const authState = await auth()
    const claims = authState.sessionClaims as Record<string, unknown> | null | undefined

    if (claims && !isClerkAdminFromClaims(claims)) {
      const explicitRole = getExplicitClerkRole(claims)

      if (explicitRole && explicitRole !== 'admin' && explicitRole !== 'super_admin') {
        return NextResponse.redirect(new URL('/dashboard/overview?error=admin_unauthorized', request.url))
      }
    }
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
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|mp4|webm|mov)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
