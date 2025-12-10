import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const matchesPrefix = (path: string, prefix: string) => {
    if (prefix === "/") return path === "/";
    return path === prefix || path.startsWith(`${prefix}/`);
  };

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

  const isStaticAsset =
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/static/") ||
    pathname === "/favicon.png" ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.png" ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp|css|js|woff|woff2|ttf|eot)$/);

  const isAuthRoute =
    pathname.startsWith("/login") || pathname.startsWith("/api/auth");

  // 1) 静态资源与内部资源放行
  if (isStaticAsset) {
    return NextResponse.next();
  }

  // 2) 登录页 & NextAuth API 放行
  if (isAuthRoute) {
    return NextResponse.next();
  }

  // 在 Edge Runtime 中，只检查 session cookie 是否存在
  // 详细的登录检查和驾照选择检查将在客户端组件中进行
  const sessionToken = request.cookies.get("authjs.session-token")?.value ||
    request.cookies.get("__Secure-authjs.session-token")?.value;

  const isAuthRequired = AUTH_REQUIRED_PREFIXES.some((prefix) =>
    matchesPrefix(pathname, prefix)
  );

  if (isAuthRequired && !sessionToken) {
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

