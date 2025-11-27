/**
 * 版本号工具
 * 生成格式：YYYY-MM-DD HH:mm:ss
 * 
 * 版本号是固定的，不会随着时间变化而变化
 * 在完成修改指令后，需要手动更新此处的 BUILD_TIME 值
 * 
 * 更新方式：将下面的 BUILD_TIME 值更新为当前时间（格式：YYYY-MM-DD HH:mm:ss）
 */

// ✅ 固定版本号（在完成修改指令后更新此值）
// 格式：YYYY-MM-DD HH:mm:ss
// 最后更新：2025-11-27 12:49:23（修复 NextAuth /api/auth/session 和 /api/auth/providers 返回 400 错误，添加环境变量检查）
const BUILD_TIME = "2025-11-27 12:49:23";

/**
 * 获取版本号（构建时间）
 */
export function getVersion(): string {
  return BUILD_TIME;
}

/**
 * 获取格式化的版本号（用于显示）
 */
export function getFormattedVersion(): string {
  return BUILD_TIME;
}

