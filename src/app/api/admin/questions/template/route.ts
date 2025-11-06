export const fetchCache = "force-no-store";
export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // 强制使用 Node.js runtime，避免 Edge runtime 兼容性问题

// ============================================================
// 文件路径: src/app/api/admin/questions/template/route.ts
// 功能: 下载题目Excel模板
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import * as XLSX from "xlsx";

// ============================================================
// GET /api/admin/questions/template
// 下载题目Excel模板
// ============================================================
export const GET = withAdminAuth(async (req: NextRequest) => {
  try {
    console.log("[GET /api/admin/questions/template] Starting template generation...");

    // 创建示例数据
    const templateData = [
      {
        卷类: "免许-1",
        类型: "single",
        题目内容: "这是一个单选题示例",
        选项A: "选项A的内容",
        选项B: "选项B的内容",
        选项C: "选项C的内容",
        选项D: "选项D的内容",
        正确答案: "A",
        图片URL: "",
        解析: "这是题目的解析说明",
      },
      {
        卷类: "免许-1",
        类型: "multiple",
        题目内容: "这是一个多选题示例",
        选项A: "选项A的内容",
        选项B: "选项B的内容",
        选项C: "选项C的内容",
        选项D: "选项D的内容",
        正确答案: "A,B",
        图片URL: "",
        解析: "这是题目的解析说明",
      },
      {
        卷类: "免许-1",
        类型: "truefalse",
        题目内容: "这是一个判断题示例",
        选项A: "",
        选项B: "",
        选项C: "",
        选项D: "",
        正确答案: "true",
        图片URL: "",
        解析: "这是题目的解析说明",
      },
    ];

    console.log("[GET /api/admin/questions/template] Creating workbook...");
    // 创建工作簿
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(templateData);

    // 设置列宽
    const colWidths = [
      { wch: 15 }, // 卷类
      { wch: 10 }, // 类型
      { wch: 40 }, // 题目内容
      { wch: 25 }, // 选项A
      { wch: 25 }, // 选项B
      { wch: 25 }, // 选项C
      { wch: 25 }, // 选项D
      { wch: 15 }, // 正确答案
      { wch: 30 }, // 图片URL
      { wch: 40 }, // 解析
    ];
    worksheet["!cols"] = colWidths;

    // 添加工作表
    XLSX.utils.book_append_sheet(workbook, worksheet, "题目模板");

    console.log("[GET /api/admin/questions/template] Generating Excel buffer...");
    // 生成Excel缓冲区 - 直接使用 buffer 类型，避免编码问题
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    console.log(`[GET /api/admin/questions/template] Excel buffer generated, size: ${buffer.length} bytes`);

    // 文件名编码 - 使用安全的 ASCII 文件名，避免编码问题
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `question-template-${dateStr}.xlsx`; // 使用英文文件名
    const displayFilename = `题目导入模板_${dateStr}.xlsx`; // 中文显示名
    const encodedDisplayFilename = encodeURIComponent(displayFilename);

    // 将 Node.js Buffer 转换为 Uint8Array，避免 ByteString 转换错误
    const uint8Array = new Uint8Array(buffer);

    // 返回文件下载
    console.log("[GET /api/admin/questions/template] Returning file download response");
    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodedDisplayFilename}`,
        "Content-Length": uint8Array.length.toString(),
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (err: any) {
    console.error("[GET /api/admin/questions/template] Error:", err);
    console.error("[GET /api/admin/questions/template] Error name:", err?.name);
    console.error("[GET /api/admin/questions/template] Error message:", err?.message);
    console.error("[GET /api/admin/questions/template] Error stack:", err?.stack);
    
    // 返回 JSON 错误响应 - 确保错误消息是安全的 ASCII 字符串
    const safeMessage = err?.message 
      ? String(err.message).replace(/[^\x20-\x7E]/g, "?") // 替换非 ASCII 字符
      : "Failed to generate template";
    
    const errorResponse = {
      ok: false,
      errorCode: "INTERNAL_ERROR",
      message: safeMessage,
      ...(process.env.NODE_ENV === "development" && {
        details: err?.stack ? String(err.stack).replace(/[^\x20-\x7E]/g, "?") : undefined,
        errorName: err?.name || "UnknownError",
      }),
    };

    return NextResponse.json(errorResponse, {
      status: 500,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  }
});

