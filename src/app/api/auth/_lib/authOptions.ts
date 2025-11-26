/**
 * 中间文件：重新导出 authOptions
 * 用于解决 catch-all 路由 [...nextauth] 的模块解析问题
 * 使用相对路径，避免 webpack 构建时路径别名解析失败
 * 
 * 路径计算：
 * - _lib/ 向上 -> auth/
 * - auth/ 向上 -> api/
 * - api/ 向上 -> app/
 * - app/ 向上 -> src/
 * - 然后进入 lib/ -> lib/auth
 */
export { authOptions } from "../../../../lib/auth";

