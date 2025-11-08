import { createHash } from "crypto";

/**
 * 计算内容的 SHA256 哈希值
 * @param content 要哈希的内容
 * @returns SHA256 哈希值（十六进制字符串）
 */
export function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * 验证内容哈希是否匹配
 * @param content 内容
 * @param hash 期望的哈希值
 * @returns 是否匹配
 */
export function verifyContentHash(content: string, hash: string): boolean {
  const computedHash = hashContent(content);
  return computedHash === hash;
}

