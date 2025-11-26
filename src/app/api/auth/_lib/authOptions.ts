/**
 * 中间文件：重新导出 authOptions
 * 用于解决 catch-all 路由 [...nextauth] 的模块解析问题
 * 使用更短的相对路径，避免 webpack 构建时解析失败
 */
export { authOptions } from "@/lib/auth";

