import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { badRequest, internalError, success } from "@/app/api/_lib/errors";
import { getProcessorUrl } from "../_lib/getProcessorUrl";

export const POST = withAdminAuth(async (req: Request) => {
  const requestId = `api-batch-process-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  try {
    console.log(`[API BatchProcess] [${requestId}] Request received`);
    const body = await req.json().catch(() => ({}));
    const { questionIds, operations, translateOptions, polishOptions, batchSize, continueOnError } = body || {};
    
    // 获取当前管理员ID（从请求中）
    const adminId = (req as any).adminId || null;
    console.log(`[API BatchProcess] [${requestId}] Body:`, { 
      questionIdsCount: questionIds?.length || 0, 
      operations, 
      translateOptions, 
      polishOptions,
      batchSize,
      continueOnError
    });
    
    // 验证必需参数
    if (!operations || !Array.isArray(operations) || operations.length === 0) {
      console.error(`[API BatchProcess] [${requestId}] Missing or invalid operations`);
      return badRequest("operations array is required and must not be empty");
    }
    
    // 验证操作选项
    if (operations.includes("translate") && !translateOptions) {
      console.error(`[API BatchProcess] [${requestId}] Missing translateOptions`);
      return badRequest("translateOptions is required when 'translate' operation is included");
    }
    
    if (operations.includes("polish") && !polishOptions) {
      console.error(`[API BatchProcess] [${requestId}] Missing polishOptions`);
      return badRequest("polishOptions is required when 'polish' operation is included");
    }
    
    const processorUrl = getProcessorUrl();
    console.log(`[API BatchProcess] [${requestId}] Calling processor: ${processorUrl}/batch-process`);
    
    const upstream = await fetch(`${processorUrl}/batch-process`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ 
        questionIds, 
        operations, 
        translateOptions, 
        polishOptions, 
        batchSize: batchSize || 10,
        continueOnError: continueOnError !== false,
        createdBy: adminId ? String(adminId) : undefined
      })
    });
    
    console.log(`[API BatchProcess] [${requestId}] Processor response status: ${upstream.status}`);
    const text = await upstream.text();
    console.log(`[API BatchProcess] [${requestId}] Processor response text length: ${text.length}`);
    
    let json: any;
    try { 
      json = JSON.parse(text); 
      console.log(`[API BatchProcess] [${requestId}] Processor response parsed successfully`);
    } catch (e) {
      console.error(`[API BatchProcess] [${requestId}] Failed to parse JSON:`, text.substring(0, 200));
      return internalError(`Processor returned invalid JSON: ${text.substring(0, 200)}`);
    }
    
    if (!upstream.ok || !json?.ok) {
      console.error(`[API BatchProcess] [${requestId}] Processor error:`, json?.message || upstream.status);
      return internalError(json?.message || `Processor error: ${upstream.status}`);
    }
    
    console.log(`[API BatchProcess] [${requestId}] Request completed successfully`);
    console.log(`[API BatchProcess] [${requestId}] Results:`, {
      total: json.data?.total,
      processed: json.data?.processed,
      succeeded: json.data?.succeeded,
      failed: json.data?.failed
    });
    
    return success(json.data || { ok: true });
  } catch (e: any) {
    console.error(`[API BatchProcess] [${requestId}] Error:`, e?.message, e?.stack);
    return internalError(e?.message || "Batch process failed");
  }
});

// GET /api/admin/question-processing/batch-process - 查询任务状态
export const GET = withAdminAuth(async (req: Request) => {
  const requestId = `api-batch-process-get-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  try {
    const url = new URL(req.url);
    const taskId = url.searchParams.get("taskId");
    const status = url.searchParams.get("status");
    const limit = url.searchParams.get("limit");
    const offset = url.searchParams.get("offset");
    
    const processorUrl = getProcessorUrl();
    
    // 如果提供了taskId，查询单个任务
    if (taskId) {
      console.log(`[API BatchProcess] [${requestId}] Fetching task: ${taskId}`);
      const upstream = await fetch(`${processorUrl}/batch-process/${taskId}`, {
        method: "GET",
        headers: { "content-type": "application/json" }
      });
      
      const text = await upstream.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch (e) {
        return internalError(`Processor returned invalid JSON: ${text.substring(0, 200)}`);
      }
      
      if (!upstream.ok || !json?.ok) {
        return internalError(json?.message || `Processor error: ${upstream.status}`);
      }
      
      return success(json.data);
    }
    
    // 否则查询所有任务
    console.log(`[API BatchProcess] [${requestId}] Fetching tasks`, { status, limit, offset });
    const queryParams = new URLSearchParams();
    if (status) queryParams.set("status", status);
    if (limit) queryParams.set("limit", limit);
    if (offset) queryParams.set("offset", offset);
    
    const upstream = await fetch(`${processorUrl}/batch-process?${queryParams.toString()}`, {
      method: "GET",
      headers: { "content-type": "application/json" }
    });
    
    const text = await upstream.text();
    let json: any;
    try {
      json = JSON.parse(text);
    } catch (e) {
      return internalError(`Processor returned invalid JSON: ${text.substring(0, 200)}`);
    }
    
    if (!upstream.ok || !json?.ok) {
      return internalError(json?.message || `Processor error: ${upstream.status}`);
    }
    
    return success(json.data);
  } catch (e: any) {
    console.error(`[API BatchProcess] [${requestId}] Error:`, e?.message, e?.stack);
    return internalError(e?.message || "Failed to fetch batch process tasks");
  }
});

