import { NextResponse, type NextRequest } from "next/server";

/**
 * The admin lives at a path only you know. `/admin` itself returns a 404, so
 * someone guessing the obvious address learns nothing — there's no login page
 * to attack, and no hint that an admin exists.
 *
 * Set ADMIN_PATH to something unguessable, e.g. "kb-9f42-portal".
 */
const SECRET = process.env.ADMIN_PATH?.replace(/^\/+|\/+$/g, "");

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // No secret path configured: behave normally, so local development works.
  if (!SECRET) return NextResponse.next();

  // The secret path serves the admin.
  if (pathname === `/${SECRET}` || pathname.startsWith(`/${SECRET}/`)) {
    const url = req.nextUrl.clone();
    url.pathname = pathname.replace(`/${SECRET}`, "/admin") || "/admin";
    return NextResponse.rewrite(url);
  }

  // Anyone poking at /admin gets the same 404 as any other missing page.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  // API routes are left alone — they have their own session checks.
  matcher: ["/admin/:path*", "/((?!api|_next|favicon.ico).*)"],
};
