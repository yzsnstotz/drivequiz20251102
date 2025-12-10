import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const PUBLIC_PATH_PREFIXES = [
    "/",
    "/license",
    "/services",
    "/vehicles",
    "/about",
    "/terms",
    "/privacy",
  ];

  const AUTH_REQUIRED_PREFIXES = [
    "/study",
    "/license/study",
    "/license/exam",
    "/ai",
    "/profile",
    "/admin",
  ];

  // 白名单：登录页、API、静态资源
  const isWhitelisted =
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/static/") ||
    pathname === "/favicon.png" ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.png" ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp|css|js|woff|woff2|ttf|eot)$/);

  if (isWhitelisted) {
    return NextResponse.next();
  }

  // 公共信息页（只读）放行，但排除需要登录的子路径
  const isPublicInfoPage =
    PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix)) &&
    !AUTH_REQUIRED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isPublicInfoPage) {
    return NextResponse.next();
  }

  // 在 Edge Runtime 中，只检查 session cookie 是否存在
  // 详细的登录检查和驾照选择检查将在客户端组件中进行
  const sessionToken = request.cookies.get("authjs.session-token")?.value ||
    request.cookies.get("__Secure-authjs.session-token")?.value;

  const requiresAuth = AUTH_REQUIRED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (requiresAuth && !sessionToken) {
    const loginUrl = new URL("/login", request.url);
    const callbackUrl = `${pathname}${request.nextUrl.search || ""}`;
    loginUrl.searchParams.set("callbackUrl", callbackUrl);
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

