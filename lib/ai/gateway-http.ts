import { NextResponse } from "next/server";

import { isAIError } from "@/lib/ai/ai-error";

/**
 * Turns a gateway failure into the HTTP answer a route should send back.
 *
 * The `code` is the part that matters: it is a stable identifier the frontend
 * maps to a translated message (`aiErrors.<code>` in `public/locales`), so the
 * merchant reads "আপনার credit শেষ" in Bengali instead of an English string
 * produced on the server. `error` carries the English text for logs and for
 * anyone calling the API directly.
 *
 * Anything that is not an `AIError` keeps the route's original generic 500 —
 * a bug should not be disguised as a provider problem.
 */
export function aiErrorResponse(error: unknown, genericMessage = "Internal server error") {
  if (isAIError(error)) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }

  return NextResponse.json({ error: genericMessage }, { status: 500 });
}
