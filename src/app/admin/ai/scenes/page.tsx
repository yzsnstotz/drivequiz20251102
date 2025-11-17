"use client";

import { useState, useEffect } from "react";

type SceneConfig = {
  id: number;
  scene_key: string;
  scene_name: string;
  system_prompt_zh: string;
  system_prompt_ja: string | null;
  system_prompt_en: string | null;
  output_format: string | null;
  max_length: number;
  temperature: number;
  enabled: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type SceneConfigResp = {
  ok: boolean;
  data?: SceneConfig[];
  message?: string;
};

function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_BASE_URL ?? "";
}

function getAuthToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("ADMIN_TOKEN") || localStorage.getItem("adminToken");
  }
  return null;
}

async function fetchScenes(): Promise<SceneConfigResp> {
  const base = getBaseUrl();
  const token = getAuthToken();
  
  try {
    console.log("[fetchScenes] 开始获取场景配置", {
      baseUrl: base,
      hasToken: !!token,
    });
    
    const res = await fetch(`${base}/api/admin/ai/scenes`, {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    
    console.log("[fetchScenes] 收到响应", {
      status: res.status,
      statusText: res.statusText,
      ok: res.ok,
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error("[fetchScenes] 响应错误", {
        status: res.status,
        statusText: res.statusText,
        errorText: errorText.substring(0, 200),
      });
      
      let errorData: any;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText || `HTTP ${res.status}: ${res.statusText}` };
      }
      
      return {
        ok: false,
        message: errorData.message || `请求失败: ${res.status} ${res.statusText}`,
      };
    }
    
    const data = await res.json();
    console.log("[fetchScenes] 解析成功", {
      ok: data.ok,
      scenesCount: data.data?.length || 0,
    });
    
    return data;
  } catch (error) {
    console.error("[fetchScenes] 请求异常", {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : String(error),
    });
    
    return {
      ok: false,
      message: error instanceof Error 
        ? (error.message.includes("Failed to fetch") 
          ? "网络请求失败，请检查网络连接或服务器状态" 
          : error.message)
        : "获取场景配置失败",
    };
  }
}

async function saveScene(scene: Partial<SceneConfig> & { id?: number }): Promise<{ ok: boolean; message?: string }> {
  const base = getBaseUrl();
  const token = getAuthToken();
  const method = scene.id ? "PUT" : "POST";
  const res = await fetch(`${base}/api/admin/ai/scenes`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(scene),
  });
  return res.json();
}

async function deleteScene(id: number): Promise<{ ok: boolean; message?: string }> {
  const base = getBaseUrl();
  const token = getAuthToken();
  const res = await fetch(`${base}/api/admin/ai/scenes?id=${id}`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.json();
}

type TestState = {
  sceneId: number;
  testing: boolean;
  testInput: string;
  testResult: string | null;
  testError: string | null;
  sourceLanguage?: string; // 源语言（用于翻译场景）
  targetLanguage?: string; // 目标语言（用于翻译场景）
};

export default function AdminAiScenesPage() {
  const [scenes, setScenes] = useState<SceneConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingScene, setEditingScene] = useState<SceneConfig | null>(null);
  const [isNewScene, setIsNewScene] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testStates, setTestStates] = useState<Record<number, TestState>>({});

  useEffect(() => {
    loadScenes();
  }, []);

  const loadScenes = async () => {
    setLoading(true);
    try {
      const resp = await fetchScenes();
      if (resp.ok && resp.data) {
        setScenes(resp.data);
      } else {
        console.error("Failed to load scenes:", resp.message);
        alert(`加载场景配置失败: ${resp.message || "未知错误"}`);
      }
    } catch (err) {
      console.error("Failed to load scenes:", err);
      alert(`加载场景配置失败: ${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (scene: SceneConfig) => {
    setEditingScene({ ...scene });
    setIsNewScene(false);
  };

  const handleNew = () => {
    setEditingScene({
      id: 0,
      scene_key: "",
      scene_name: "",
      system_prompt_zh: "",
      system_prompt_ja: null,
      system_prompt_en: null,
      output_format: null,
      max_length: 1000,
      temperature: 0.4,
      enabled: true,
      description: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    setIsNewScene(true);
  };

  const handleSave = async () => {
    if (!editingScene) return;

    if (!editingScene.scene_key || !editingScene.scene_name || !editingScene.system_prompt_zh) {
      alert("请填写场景标识、场景名称和中文系统 prompt");
      return;
    }

    setSaving(true);
    setSaveSuccess(false);
    try {
      const resp = await saveScene(editingScene);
      if (resp.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        setEditingScene(null);
        setIsNewScene(false);
        loadScenes();
      } else {
        alert(resp.message || "保存失败");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除这个场景配置吗？")) return;

    try {
      const resp = await deleteScene(id);
      if (resp.ok) {
        loadScenes();
      } else {
        alert(resp.message || "删除失败");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "删除失败");
    }
  };

  const handleTest = async (scene: SceneConfig) => {
    const testInput = testStates[scene.id]?.testInput || "";
    if (!testInput.trim()) {
      alert("请输入测试问题");
      return;
    }

    // 初始化测试状态
    setTestStates((prev) => ({
      ...prev,
      [scene.id]: {
        sceneId: scene.id,
        testing: true,
        testInput: testInput,
        testResult: null,
        testError: null,
      },
    }));

    try {
      const base = getBaseUrl();
      const locale = (typeof navigator !== "undefined" && navigator.language) || "zh-CN";
      const testId = `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      console.log(`[Scene Test] [${testId}] 开始测试场景`, {
        sceneKey: scene.scene_key,
        sceneName: scene.scene_name,
        questionLength: testInput.length,
        locale: locale,
        baseUrl: base,
      });

      // 测试功能使用匿名模式，不传递管理员 token
      // /api/ai/ask 会自动使用 anonymous 作为 userId
      // 添加超时控制（60秒）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.error(`[Scene Test] [${testId}] 请求超时（60秒）`);
        controller.abort();
      }, 60000);

      const requestBody: any = {
        question: testInput,
        locale: locale,
        scene: scene.scene_key,
        skipCache: true, // 测试场景禁用缓存，确保每次都能获得新结果
        testMode: true, // 标记为测试模式，后端会优先使用直连模式以加快响应
      };

      // 如果是翻译场景，添加源语言和目标语言参数
      if (scene.scene_key === "question_translation") {
        const testState = testStates[scene.id] || {};
        if (testState.sourceLanguage) {
          requestBody.sourceLanguage = testState.sourceLanguage;
        }
        if (testState.targetLanguage) {
          requestBody.targetLanguage = testState.targetLanguage;
        }
      }

      const fetchStartTime = Date.now();
      
      // 获取当前配置的 provider（从配置中心）
      const { getCurrentAiProvider } = await import("@/lib/aiProviderConfig.front");
      const providerConfig = await getCurrentAiProvider();
      const provider: "local" | "render" = providerConfig.provider;
      
      console.log(`[Scene Test] [${testId}] 使用 provider:`, {
        provider,
        model: providerConfig.model,
        scene: scene.scene_key,
      });

      // 使用新的 callAiDirect 函数
      const { callAiDirect } = await import("@/lib/aiClient.front");
      const payload = await callAiDirect({
        provider,
        question: requestBody.question,
        locale: requestBody.locale || "zh",
        scene: requestBody.scene,
        model: providerConfig.model,
      });

      clearTimeout(timeoutId);
      const fetchDuration = Date.now() - fetchStartTime;
      console.log(`[Scene Test] [${testId}] 收到响应`, {
        ok: payload.ok,
        duration: `${fetchDuration}ms`,
        hasAnswer: !!payload.data?.answer,
      });

      if (payload.ok && payload.data?.answer) {
        console.log(`[Scene Test] [${testId}] 测试成功`, {
          answerLength: payload.data.answer.length,
        });
        setTestStates((prev) => ({
          ...prev,
          [scene.id]: {
            sceneId: scene.id,
            testing: false,
            testInput: testInput,
            testResult: payload.data!.answer,
            testError: null,
          },
        }));
      } else {
        console.error(`[Scene Test] [${testId}] 测试失败`, {
          ok: payload.ok,
          message: payload.message,
          errorCode: payload.errorCode,
        });
        setTestStates((prev) => ({
          ...prev,
          [scene.id]: {
            sceneId: scene.id,
            testing: false,
            testInput: testInput,
            testResult: null,
            testError: payload.message || payload.errorCode || "测试失败",
          },
        }));
      }
    } catch (err) {
      console.error(`[Scene Test] 测试异常`, {
        sceneKey: scene.scene_key,
        error: err instanceof Error ? {
          name: err.name,
          message: err.message,
          stack: err.stack,
        } : String(err),
      });

      let errorMessage = "测试失败";
      if (err instanceof Error) {
        if (err.name === "AbortError" || err.message.includes("timeout")) {
          errorMessage = "请求超时（60秒），请检查网络连接或稍后重试";
        } else if (err.message.includes("Failed to fetch") || err.message.includes("ERR_TIMED_OUT")) {
          errorMessage = "网络请求超时，请检查网络连接或 AI 服务是否正常运行";
        } else {
          errorMessage = err.message;
        }
      }
      
      setTestStates((prev) => ({
        ...prev,
        [scene.id]: {
          sceneId: scene.id,
          testing: false,
          testInput: testInput,
          testResult: null,
          testError: errorMessage,
        },
      }));
    }
  };

  const updateTestInput = (sceneId: number, input: string) => {
    setTestStates((prev) => ({
      ...prev,
      [sceneId]: {
        ...(prev[sceneId] || { sceneId, testing: false, testInput: "", testResult: null, testError: null }),
        testInput: input,
      },
    }));
  };

  const updateTestLanguage = (sceneId: number, field: "sourceLanguage" | "targetLanguage", value: string) => {
    setTestStates((prev) => ({
      ...prev,
      [sceneId]: {
        ...(prev[sceneId] || { sceneId, testing: false, testInput: "", testResult: null, testError: null }),
        [field]: value,
      },
    }));
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">加载中...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">AI 场景配置</h1>
        <div className="flex items-center gap-4">
          {saveSuccess && (
            <div className="px-4 py-2 bg-green-100 text-green-700 rounded text-sm">
              ✅ 保存成功
            </div>
          )}
          <button
            onClick={handleNew}
            className="px-4 py-2 rounded bg-black text-white text-sm"
          >
            + 新建场景
          </button>
        </div>
      </div>

      {editingScene && (
        <div className="border rounded-lg p-6 space-y-4 bg-white">
          <h2 className="font-medium text-lg">
            {isNewScene ? "新建场景配置" : "编辑场景配置"}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                场景标识 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={editingScene.scene_key}
                onChange={(e) =>
                  setEditingScene({ ...editingScene, scene_key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })
                }
                disabled={!isNewScene}
                className="w-full border rounded px-3 py-2 disabled:bg-gray-100"
                placeholder="chat, question_explanation"
              />
              <p className="text-xs text-gray-500 mt-1">
                只允许小写字母、数字、下划线，创建后不可修改
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                场景名称 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={editingScene.scene_name}
                onChange={(e) =>
                  setEditingScene({ ...editingScene, scene_name: e.target.value })
                }
                className="w-full border rounded px-3 py-2"
                placeholder="首页 AI 助手对话框"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                最大输出长度
              </label>
              <input
                type="number"
                min="10"
                max="10000"
                value={editingScene.max_length}
                onChange={(e) =>
                  setEditingScene({ ...editingScene, max_length: Number(e.target.value) })
                }
                className="w-full border rounded px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                温度参数
              </label>
              <input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={editingScene.temperature}
                onChange={(e) =>
                  setEditingScene({ ...editingScene, temperature: Number(e.target.value) })
                }
                className="w-full border rounded px-3 py-2"
              />
              <p className="text-xs text-gray-500 mt-1">0.0-2.0，值越高越随机</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              中文系统 Prompt <span className="text-red-500">*</span>
            </label>
            <textarea
              value={editingScene.system_prompt_zh}
              onChange={(e) =>
                setEditingScene({ ...editingScene, system_prompt_zh: e.target.value })
              }
              rows={6}
              className="w-full border rounded px-3 py-2 font-mono text-sm"
              placeholder="你是 ZALEM 驾驶考试学习助手..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              日文系统 Prompt（可选）
            </label>
            <textarea
              value={editingScene.system_prompt_ja || ""}
              onChange={(e) =>
                setEditingScene({ ...editingScene, system_prompt_ja: e.target.value || null })
              }
              rows={6}
              className="w-full border rounded px-3 py-2 font-mono text-sm"
              placeholder="あなたは ZALEM の運転免許学習アシスタントです..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              英文系统 Prompt（可选）
            </label>
            <textarea
              value={editingScene.system_prompt_en || ""}
              onChange={(e) =>
                setEditingScene({ ...editingScene, system_prompt_en: e.target.value || null })
              }
              rows={6}
              className="w-full border rounded px-3 py-2 font-mono text-sm"
              placeholder="You are ZALEM's driving-test study assistant..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              输出格式要求（可选）
            </label>
            <textarea
              value={editingScene.output_format || ""}
              onChange={(e) =>
                setEditingScene({ ...editingScene, output_format: e.target.value || null })
              }
              rows={3}
              className="w-full border rounded px-3 py-2 font-mono text-sm"
              placeholder="JSON格式：{answer: string, sources: array}..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              场景描述（可选）
            </label>
            <textarea
              value={editingScene.description || ""}
              onChange={(e) =>
                setEditingScene({ ...editingScene, description: e.target.value || null })
              }
              rows={2}
              className="w-full border rounded px-3 py-2"
              placeholder="此场景用于..."
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editingScene.enabled}
                onChange={(e) =>
                  setEditingScene({ ...editingScene, enabled: e.target.checked })
                }
                className="w-4 h-4"
              />
              <span className="text-sm">启用此场景</span>
            </label>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded bg-black text-white text-sm disabled:opacity-50"
            >
              {saving ? "保存中..." : "保存"}
            </button>
            <button
              onClick={() => {
                setEditingScene(null);
                setIsNewScene(false);
              }}
              className="px-4 py-2 rounded border text-sm"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {scenes.map((scene) => {
          const testState = testStates[scene.id] || {
            sceneId: scene.id,
            testing: false,
            testInput: "",
            testResult: null,
            testError: null,
          };

          return (
            <div key={scene.id} className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{scene.scene_name}</h3>
                  <p className="text-sm text-gray-500">
                    <code className="bg-gray-100 px-1 rounded">{scene.scene_key}</code>
                    {scene.description && ` · ${scene.description}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      scene.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {scene.enabled ? "启用" : "禁用"}
                  </span>
                  <button
                    onClick={() => handleEdit(scene)}
                    className="px-3 py-1 rounded border text-sm hover:bg-gray-50"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(scene.id)}
                    className="px-3 py-1 rounded border text-sm hover:bg-red-50 text-red-600"
                  >
                    删除
                  </button>
                </div>
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <div>
                  <span className="font-medium">最大长度:</span> {scene.max_length} 字符
                </div>
                <div>
                  <span className="font-medium">温度:</span> {scene.temperature}
                </div>
                <div className="mt-2">
                  <span className="font-medium">中文 Prompt:</span>
                  <div className="mt-1 p-2 bg-gray-50 rounded text-xs font-mono line-clamp-2">
                    {scene.system_prompt_zh}
                  </div>
                </div>
              </div>

              {/* 测试功能 */}
              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">测试场景</h4>
                  <button
                    onClick={() => handleTest(scene)}
                    disabled={testState.testing || !scene.enabled}
                    className="px-3 py-1 rounded bg-blue-500 text-white text-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {testState.testing ? "测试中..." : "测试"}
                  </button>
                </div>
                {/* 如果是翻译场景，显示源语言和目标语言选择器 */}
                {scene.scene_key === "question_translation" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">源语言</label>
                      <select
                        value={testState.sourceLanguage || "zh"}
                        onChange={(e) => updateTestLanguage(scene.id, "sourceLanguage", e.target.value)}
                        className="w-full border rounded px-3 py-2 text-sm"
                        disabled={testState.testing}
                      >
                        <option value="zh">中文 (zh)</option>
                        <option value="ja">日文 (ja)</option>
                        <option value="en">英文 (en)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">目标语言</label>
                      <select
                        value={testState.targetLanguage || "ja"}
                        onChange={(e) => updateTestLanguage(scene.id, "targetLanguage", e.target.value)}
                        className="w-full border rounded px-3 py-2 text-sm"
                        disabled={testState.testing}
                      >
                        <option value="zh">中文 (zh)</option>
                        <option value="ja">日文 (ja)</option>
                        <option value="en">英文 (en)</option>
                      </select>
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-1">测试输入（模拟用户问题）</label>
                  <textarea
                    value={testState.testInput}
                    onChange={(e) => updateTestInput(scene.id, e.target.value)}
                    placeholder={scene.scene_key === "question_translation" ? "输入题目内容，例如：\nContent: 这是什么标志？\nOptions:\n- 禁止通行\n- 注意行人\nExplanation: 这是禁止通行的标志" : "输入测试问题，例如：什么是交通标志？"}
                    rows={3}
                    className="w-full border rounded px-3 py-2 text-sm"
                    disabled={testState.testing}
                  />
                </div>
                {testState.testResult && (
                  <div>
                    <label className="block text-sm font-medium mb-1">AI 回复</label>
                    <div className="p-3 bg-green-50 border border-green-200 rounded text-sm whitespace-pre-wrap">
                      {testState.testResult}
                    </div>
                  </div>
                )}
                {testState.testError && (
                  <div>
                    <label className="block text-sm font-medium mb-1 text-red-600">错误</label>
                    <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                      {testState.testError}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {scenes.length === 0 && !editingScene && (
        <div className="text-center py-12 text-gray-500">
          <p>还没有场景配置</p>
          <button
            onClick={handleNew}
            className="mt-4 px-4 py-2 rounded bg-black text-white text-sm"
          >
            + 创建第一个场景
          </button>
        </div>
      )}
    </div>
  );
}


