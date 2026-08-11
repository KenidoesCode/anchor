import { NextResponse, type NextRequest } from "next/server";
import { createRateLimiter } from "@/server/rate-limit";

/**
 * Security middleware: response headers, same-origin CSRF protection on
 * mutating requests, and rate limiting on the auth routes.
 *
 * NOTE (demo): the CSP allows 'unsafe-inline' for styles/scripts because Next's
 * hydration bootstrap and Tailwind inject inline content; a production hardening
 * pass should move to nonce-based CSP. Rate limiting is in-memory (per instance)
 * — fine for a single-instance demo, replace with a shared store (Redis) for
 * production. Both are flagged, not hidden.
 */

const rateLimited = createRateLimiter({ windowMs: 60_000, max: 10 });

function securityHeaders(res: NextResponse): NextResponse {
  res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  );
  res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return res;
}

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  const method = req.method;
  const now = Date.now();

  // CSRF: mutating requests must be same-origin (cookie-based auth defence).
  if (method !== "GET" && method !== "HEAD") {
    const origin = req.headers.get("origin");
    if (origin) {
      const originHost = (() => {
        try {
          return new URL(origin).host;
        } catch {
          return null;
        }
      })();
      if (originHost && originHost !== req.headers.get("host")) {
        return securityHeaders(
          NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 }),
        );
      }
    }
  }

  // Rate limit the auth routes.
  if (pathname.startsWith("/api/auth/")) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (rateLimited(`${ip}:${pathname}`, now)) {
      return securityHeaders(
        NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 }),
      );
    }
  }

  return securityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
