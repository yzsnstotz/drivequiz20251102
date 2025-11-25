#!/usr/bin/env tsx
/**
 * 自动修复常见的构建错误
 * 使用方法: npx tsx scripts/auto-fix-build-errors.ts
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { glob } from 'glob';
import path from 'path';

interface BuildError {
  file: string;
  line: number;
  column: number;
  message: string;
  code?: string;
}

/**
 * 解析 TypeScript 错误日志
 */
function parseTypeScriptErrors(logContent: string): BuildError[] {
  const errors: BuildError[] = [];
  const errorRegex = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/gm;
  
  let match;
  while ((match = errorRegex.exec(logContent)) !== null) {
    errors.push({
      file: match[1],
      line: parseInt(match[2]),
      column: parseInt(match[3]),
      code: match[4],
      message: match[5],
    });
  }
  
  return errors;
}

/**
 * 解析 Next.js 构建错误
 */
function parseNextBuildErrors(logContent: string): BuildError[] {
  const errors: BuildError[] = [];
  
  // 匹配 Type error 格式
  const typeErrorRegex = /\.\/(.+?):(\d+):(\d+)\s+Type error:\s+(.+?)(?=\n\n|$)/gs;
  let match;
  while ((match = typeErrorRegex.exec(logContent)) !== null) {
    errors.push({
      file: match[1],
      line: parseInt(match[2]),
      column: parseInt(match[3]),
      message: match[4],
    });
  }
  
  return errors;
}

/**
 * 修复常见的类型错误
 */
function fixCommonErrors(filePath: string, errors: BuildError[]): boolean {
  if (!existsSync(filePath)) {
    console.log(`⚠️  文件不存在: ${filePath}`);
    return false;
  }
  
  let content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  let modified = false;
  
  for (const error of errors) {
    const lineIndex = error.line - 1;
    if (lineIndex < 0 || lineIndex >= lines.length) continue;
    
    const line = lines[lineIndex];
    
    // 修复: 'xxx' is possibly 'null' 或 'undefined'
    if (error.message.includes("is possibly 'null'") || error.message.includes("is possibly 'undefined'")) {
      // 检查是否已经有空值检查
      if (line.includes('?.') || line.includes('||') || line.includes('&&')) {
        continue; // 已经有处理
      }
      
      // 尝试添加可选链或空值合并
      const nullCheckPattern = /(\w+)\[(\d+)\]/;
      const match = line.match(nullCheckPattern);
      if (match) {
        const newLine = line.replace(
          `${match[1]}[${match[2]}]`,
          `${match[1]}?.[${match[2]}] || ''`
        );
        lines[lineIndex] = newLine;
        modified = true;
        console.log(`✅ 修复 ${filePath}:${error.line} - 添加空值检查`);
      }
    }
    
    // 修复: Property 'xxx' does not exist on type 'never'
    if (error.message.includes("does not exist on type 'never'")) {
      // 这通常是因为类型收窄失败，需要添加类型断言或类型守卫
      console.log(`⚠️  需要手动修复 ${filePath}:${error.line} - 类型收窄问题`);
    }
    
    // 修复: Cannot invoke an object which is possibly 'undefined'
    if (error.message.includes("Cannot invoke an object which is possibly 'undefined'")) {
      const invokePattern = /(\w+)\(/;
      const match = line.match(invokePattern);
      if (match) {
        const newLine = line.replace(
          `${match[1]}(`,
          `${match[1]}?.() || `
        );
        lines[lineIndex] = newLine;
        modified = true;
        console.log(`✅ 修复 ${filePath}:${error.line} - 添加可选调用`);
      }
    }
    
    // 修复: Type 'xxx' is not assignable to type 'ReactNode'
    if (error.message.includes("is not assignable to type 'ReactNode'")) {
      // 这通常是因为直接渲染了对象，需要转换为字符串
      if (line.includes('{') && line.includes('}')) {
        console.log(`⚠️  需要手动修复 ${filePath}:${error.line} - ReactNode 类型问题`);
      }
    }
  }
  
  if (modified) {
    content = lines.join('\n');
    writeFileSync(filePath, content, 'utf-8');
    return true;
  }
  
  return false;
}

/**
 * 主函数
 */
async function main() {
  console.log('🔍 开始分析构建错误...\n');
  
  // 读取构建日志
  const logFiles = [
    'build-errors.log',
    'typecheck-errors.log',
    '.next/build.log',
  ];
  
  let allErrors: BuildError[] = [];
  
  for (const logFile of logFiles) {
    if (existsSync(logFile)) {
      console.log(`📄 读取日志: ${logFile}`);
      const content = readFileSync(logFile, 'utf-8');
      
      if (logFile.includes('typecheck')) {
        allErrors.push(...parseTypeScriptErrors(content));
      } else {
        allErrors.push(...parseNextBuildErrors(content));
      }
    }
  }
  
  if (allErrors.length === 0) {
    console.log('✅ 未发现构建错误！');
    return;
  }
  
  console.log(`\n📊 发现 ${allErrors.length} 个错误\n`);
  
  // 按文件分组
  const errorsByFile = new Map<string, BuildError[]>();
  for (const error of allErrors) {
    const fullPath = path.resolve(error.file);
    if (!errorsByFile.has(fullPath)) {
      errorsByFile.set(fullPath, []);
    }
    errorsByFile.get(fullPath)!.push(error);
  }
  
  // 尝试修复每个文件
  let fixedCount = 0;
  for (const [filePath, errors] of errorsByFile) {
    console.log(`\n🔧 处理文件: ${filePath}`);
    console.log(`   发现 ${errors.length} 个错误`);
    
    if (fixCommonErrors(filePath, errors)) {
      fixedCount++;
      console.log(`   ✅ 已自动修复`);
    } else {
      console.log(`   ⚠️  需要手动修复`);
      errors.forEach(err => {
        console.log(`      - 行 ${err.line}: ${err.message.substring(0, 60)}...`);
      });
    }
  }
  
  console.log(`\n📈 修复统计:`);
  console.log(`   - 总错误数: ${allErrors.length}`);
  console.log(`   - 已修复文件: ${fixedCount}/${errorsByFile.size}`);
  console.log(`   - 需要手动修复: ${errorsByFile.size - fixedCount}`);
  
  if (fixedCount > 0) {
    console.log('\n✅ 已自动修复部分错误，请运行构建检查是否还有其他问题。');
  }
}

// 运行
main().catch(console.error);

