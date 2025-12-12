export const AUTH_REQUIRED_PREFIXES = [
  "/study",
  "/license/study",
  "/license/exam",
  "/ai",
  "/activation",
  "/profile",
  "/admin",
  "/student",
];

export function isAuthRequiredPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return AUTH_REQUIRED_PREFIXES.some((prefix) => {
    if (prefix === "/") return pathname === "/";
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}
