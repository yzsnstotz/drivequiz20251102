import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const matchesPrefix = (path: string, prefix: string) => {
    if (prefix === "/") return path === "/";
    return path === prefix || path.startsWith(`${prefix}/`);
  };

  const AUTH_REQUIRED_PREFIXES = [
    "/study",
    "/license/study",
    "/license/exam",
    "/ai",
    "/profile",
    "/admin",
  ];

  const isStaticAsset =
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/static/") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|css|js|woff2?|ttf|eot)$/) !== null;

  const isAuthRoute =
    pathname === "/login" || pathname.startsWith("/api/auth");

  // 1) 静态资源与内部资源放行
  if (isStaticAsset) {
    return NextResponse.next();
  }

  // 2) 登录页 & NextAuth API 放行
  if (isAuthRoute) {
    return NextResponse.next();
  }

  // 在 Edge Runtime 中，仅获取一次登录态
  const token = await getToken({ req: request });
  const isAuthenticated = !!token;

  const isAuthRequired = AUTH_REQUIRED_PREFIXES.some((prefix) =>
    matchesPrefix(pathname, prefix)
  );

  if (isAuthRequired && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.toString());
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径，除了：
     * - api路由
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon files (favicon.ico, favicon.png, icon.png)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|favicon.png|icon.png).*)",
  ],
};

