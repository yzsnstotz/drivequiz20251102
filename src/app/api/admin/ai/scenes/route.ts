import { withAdminAuth } from "@/app/api/_lib/withAdminAuth";
import { badRequest, internalError, success } from "@/app/api/_lib/errors";
import { aiDb } from "@/lib/aiDb";

// GET /api/admin/ai/scenes - 获取所有场景配置
export const GET = withAdminAuth(async (req: Request) => {
  const requestId = `scenes-get-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  try {
    console.log(`[${requestId}] [GET /api/admin/ai/scenes] 开始获取场景配置`);
    const startTime = Date.now();
    
    const scenes = await aiDb
      .selectFrom("ai_scene_config")
      .selectAll()
      .orderBy("scene_key", "asc")
      .execute();

    const duration = Date.now() - startTime;
    console.log(`[${requestId}] [GET /api/admin/ai/scenes] 查询完成`, {
      count: scenes.length,
      duration: `${duration}ms`,
    });

    return success(scenes);
  } catch (e: any) {
    console.error(`[${requestId}] [GET /api/admin/ai/scenes] 查询失败`, {
      error: e?.message,
      stack: e?.stack,
    });
    return internalError(e?.message || "Failed to fetch scene configs");
  }
});

// POST /api/admin/ai/scenes - 创建新场景配置
export const POST = withAdminAuth(async (req: Request) => {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      scene_key,
      scene_name,
      system_prompt_zh,
      system_prompt_ja,
      system_prompt_en,
      output_format,
      max_length,
      temperature,
      enabled,
      description,
    } = body;

    if (!scene_key || !scene_name || !system_prompt_zh) {
      return badRequest("scene_key, scene_name, and system_prompt_zh are required");
    }

    // 验证 scene_key 格式（只允许字母、数字、下划线）
    if (!/^[a-z0-9_]+$/.test(scene_key)) {
      return badRequest("scene_key must contain only lowercase letters, numbers, and underscores");
    }

    // 检查是否已存在
    const existing = await aiDb
      .selectFrom("ai_scene_config")
      .select(["id"])
      .where("scene_key", "=", scene_key)
      .executeTakeFirst();

    if (existing) {
      return badRequest(`Scene with key "${scene_key}" already exists`);
    }

    // 获取当前管理员 ID（从请求中）
    const adminId = (req as any).adminId || null;

    const result = await aiDb
      .insertInto("ai_scene_config")
      .values({
        scene_key,
        scene_name,
        system_prompt_zh,
        system_prompt_ja: system_prompt_ja || null,
        system_prompt_en: system_prompt_en || null,
        output_format: output_format || null,
        max_length: max_length || 1000,
        temperature: temperature || 0.4,
        enabled: enabled !== undefined ? enabled : true,
        description: description || null,
        updated_by: adminId,
      })
      .returning(["id", "scene_key", "scene_name"])
      .executeTakeFirst();

    return success(result);
  } catch (e: any) {
    return internalError(e?.message || "Failed to create scene config");
  }
});

// PUT /api/admin/ai/scenes - 更新场景配置
export const PUT = withAdminAuth(async (req: Request) => {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      id,
      scene_key,
      scene_name,
      system_prompt_zh,
      system_prompt_ja,
      system_prompt_en,
      output_format,
      max_length,
      temperature,
      enabled,
      description,
    } = body;

    if (!id) {
      return badRequest("id is required");
    }

    if (!scene_name || !system_prompt_zh) {
      return badRequest("scene_name and system_prompt_zh are required");
    }

    // 获取当前管理员 ID
    const adminId = (req as any).adminId || null;

    const updateData: any = {
      scene_name,
      system_prompt_zh,
      system_prompt_ja: system_prompt_ja !== undefined ? system_prompt_ja : null,
      system_prompt_en: system_prompt_en !== undefined ? system_prompt_en : null,
      output_format: output_format !== undefined ? output_format : null,
      max_length: max_length !== undefined ? max_length : 1000,
      temperature: temperature !== undefined ? temperature : 0.4,
      enabled: enabled !== undefined ? enabled : true,
      description: description !== undefined ? description : null,
      updated_by: adminId,
      updated_at: new Date(),
    };

    const result = await aiDb
      .updateTable("ai_scene_config")
      .set(updateData)
      .where("id", "=", id)
      .returning(["id", "scene_key", "scene_name"])
      .executeTakeFirst();

    if (!result) {
      return badRequest(`Scene config with id ${id} not found`);
    }

    return success(result);
  } catch (e: any) {
    return internalError(e?.message || "Failed to update scene config");
  }
});

// DELETE /api/admin/ai/scenes - 删除场景配置
export const DELETE = withAdminAuth(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return badRequest("id is required");
    }

    const result = await aiDb
      .deleteFrom("ai_scene_config")
      .where("id", "=", Number(id))
      .returning(["id", "scene_key"])
      .executeTakeFirst();

    if (!result) {
      return badRequest(`Scene config with id ${id} not found`);
    }

    return success({ deleted: result });
  } catch (e: any) {
    return internalError(e?.message || "Failed to delete scene config");
  }
});


