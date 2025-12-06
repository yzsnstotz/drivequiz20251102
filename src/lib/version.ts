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
// 最后更新：2025-12-06 12:00:00（前台题库加载逻辑缓存优先修复）
const BUILD_TIME = "2025-12-06 12:00:00";

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
