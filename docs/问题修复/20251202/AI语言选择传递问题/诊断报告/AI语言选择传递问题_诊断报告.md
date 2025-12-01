# 🔧 Cursor 问题诊断报告
**Issue ID:** CP-20251202-001  
**报告日期:** 2025-12-02  
**诊断人员:** Cursor AI Assistant

---

## 📌 第一部分：问题概要（Summary）

| 字段 | 填写内容 |
|------|---------|
| **问题名称** | 用户选择语言无法传递到AI服务，导致AI始终使用中文prompt |
| **问题等级** | High |
| **触发时间** | 2025-12-02（持续性问题） |
| **触发环境** | local / production |
| **相关模块** | web (前端) / ai-service (后端) |
| **当前状态** | 可复现 |

---

## 📌 第二部分：复现路径（Reproduce Steps）

### 前端操作步骤
1. 用户在语言选择页面（`/language`）或设置页面选择语言（例如：English）
2. 语言设置保存到 localStorage（`user-language` 键）
3. 用户进入AI对话页面（`/ai`）
4. 用户输入问题并发送
5. 查看 local-ai-service 或 ai-service 日志

### 触发点
- **页面:** `/ai` (AI对话页面)
- **组件:** `src/components/AIPage.tsx`
- **函数:** `handleSend` (第368行)

### 请求示例
```typescript
// 前端调用
callAiDirect({
  provider: "local" | "render",
  question: "用户输入的问题",
  locale: "en-US", // 应该传递用户选择的语言
  scene: "chat",
  messages: [...],
  maxHistory: 10,
  model: "gpt-4o-mini"
})
```

### 操作系统 / 浏览器 / Node 版本
- **操作系统:** macOS / Windows / Linux
- **浏览器:** Chrome / Safari / Firefox
- **Node 版本:** 18.x / 20.x

---

## 📌 第三部分：实际输出（Actual Behavior）

### 1. 前端日志
```javascript
[AIPage] 使用用户设置的语言: {
  question: "用户输入的问题",
  userLanguage: "zh", // ❌ 问题：始终是 "zh"，而不是用户选择的 "en"
  userLocale: "zh-CN",
  timestamp: "2025-12-02T..."
}
```

### 2. 后端返回
- **HTTP 状态码:** 200 OK
- **响应内容:** AI正常返回，但使用的是中文prompt

### 3. 服务器日志（ai-service / local-ai-service）
```
[ASK ROUTE] 使用场景执行模块: {
  scene: "chat",
  locale: "zh", // ❌ 问题：接收到的是 "zh" 而不是 "en"
  sourceLanguage: null,
  targetLanguage: null,
  model: "gpt-4o-mini",
  aiProvider: "openai"
}

[SCENE-RUNNER] 使用中文 prompt (locale: "zh", lang: "zh")
```

### 4. 用户反馈
- 用户选择英文语言后，AI仍然用中文回复
- 用户选择日文语言后，AI仍然用中文回复
- local-ai-service 日志显示接收到的是 `zh` 的 locale

---

## 📌 第四部分：期望行为（Expected Behavior）

1. **用户选择语言后，应该立即生效**
   - 用户在语言选择页面选择 "English"
   - 语言保存到 localStorage (`user-language: "en"`)
   - AI对话页面应该使用英文prompt

2. **语言传递链路应该完整**
   - `LanguageContext` 应该从 localStorage 读取最新语言
   - `AIPage` 应该使用正确的 `language` 值
   - `callAiDirect` 应该传递正确的 `locale` 值
   - 后端应该接收到正确的 `lang` 值
   - `sceneRunner` 应该选择对应语言的 prompt

3. **AI回复应该使用用户选择的语言**
   - 用户选择英文 → AI用英文回复
   - 用户选择日文 → AI用日文回复
   - 用户选择中文 → AI用中文回复

---

## 📌 第五部分：代码定位（Code Snapshot）

### 1. 相关文件列表（绝对路径）

```
/Users/leo/Desktop/v3/src/contexts/LanguageContext.tsx
/Users/leo/Desktop/v3/src/components/AIPage.tsx
/Users/leo/Desktop/v3/src/lib/aiClient.front.ts
/Users/leo/Desktop/v3/apps/ai-service/src/routes/ask.ts
/Users/leo/Desktop/v3/apps/ai-service/src/lib/sceneRunner.ts
/Users/leo/Desktop/v3/src/lib/i18n.ts
```

### 2. 关键函数代码片段

#### 2.1 LanguageContext.tsx - 问题根源
```typescript:src/contexts/LanguageContext.tsx
export function LanguageProvider({ children }: { children: ReactNode }) {
  // ❌ 问题：初始状态硬编码为 'zh'
  const [language, setLanguageState] = useState<Language>('zh');
  const [mounted, setMounted] = useState(false);

  // ⚠️ 问题：useEffect 是异步的，在用户快速发送消息时可能还未执行
  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null;
      if (saved && ['zh', 'en', 'ja'].includes(saved)) {
        setLanguageState(saved); // 这里才会更新 language
      }
    }
  }, []);
  
  // ... rest of code
}
```

#### 2.2 AIPage.tsx - 使用 Context 的 language
```typescript:src/components/AIPage.tsx
const AIPageContent: React.FC<AIPageProps> = ({ onBack }) => {
  const { t, language } = useLanguage(); // ⚠️ 可能还是 'zh'
  
  const handleSend = useCallback(async () => {
    // ...
    // ❌ 问题：如果 useEffect 还未执行，language 仍然是 'zh'
    const userLocale = languageToLocale(language);
    
    const payload = await callAiDirect({
      provider: currentProvider,
      question: q,
      locale: userLocale, // ❌ 传递的是 'zh-CN' 而不是 'en-US'
      scene: "chat",
      // ...
    });
  }, [input, loading, pushMessage, messages, isActivated, showActivationModal, language, t, currentProvider, currentModel]);
}
```

#### 2.3 aiClient.front.ts - 转换 locale 为 lang
```typescript:src/lib/aiClient.front.ts
export async function callAiDirect(params: AiClientRequest): Promise<AiClientResponse> {
  // ...
  const lang = localeToLang(rest.locale); // 'en-US' → 'en'
  
  const requestBody = {
    question: rest.question,
    lang: lang, // ✅ 正确转换
    scene: rest.scene,
    // ...
  };
}
```

#### 2.4 ask.ts - 接收 lang 并传递给 sceneRunner
```typescript:apps/ai-service/src/routes/ask.ts
function parseAndValidateBody(body: unknown): {
  // ...
  lang: string;
} {
  const lang = (typeof b.lang === "string" ? b.lang.toLowerCase().trim() : "zh") || "zh";
  const validLang = LANG_WHITELIST.has(lang) ? lang : "zh";
  return { 
    // ...
    lang: validLang, // ✅ 正确解析
  };
}

// 在路由处理中
const { question, normalizedQuestion, lang, scene, sourceLanguage, targetLanguage } = parseAndValidateBody(request.body);
const promptLocale = targetLanguage || lang; // ✅ 使用 lang

sceneResult = await runScene({
  sceneKey: scene,
  locale: promptLocale, // ✅ 传递给 sceneRunner
  // ...
});
```

#### 2.5 sceneRunner.ts - 根据 locale 选择 prompt
```typescript:apps/ai-service/src/lib/sceneRunner.ts
export async function getSceneConfig(
  sceneKey: string,
  locale: string, // 接收到的 locale
  config: { supabaseUrl: string; supabaseServiceKey: string },
  options?: { timeoutMs?: number }
): Promise<SceneConfig | null> {
  // ...
  const lang = locale.toLowerCase().trim(); // 'en' → 'en'
  
  // 根据语言选择 prompt
  let prompt = sceneConfig.system_prompt_zh;
  let selectedLang = "zh";
  
  if (lang.startsWith("ja") && sceneConfig.system_prompt_ja) {
    prompt = sceneConfig.system_prompt_ja;
    selectedLang = "ja";
  } else if (lang.startsWith("en") && sceneConfig.system_prompt_en) {
    prompt = sceneConfig.system_prompt_en;
    selectedLang = "en";
  } else {
    // ❌ 问题：如果 locale 是 'zh'，会使用中文 prompt
  }
  
  return { prompt: finalPrompt, outputFormat: sceneConfig.output_format };
}
```

### 3. 数据流追踪

```
用户选择语言 "en"
  ↓
localStorage.setItem('user-language', 'en')
  ↓
LanguageContext.useEffect() [异步执行]
  ↓
setLanguageState('en') [可能还未执行]
  ↓
AIPage.useLanguage() → language = 'zh' [❌ 仍然是初始值]
  ↓
languageToLocale('zh') → 'zh-CN'
  ↓
callAiDirect({ locale: 'zh-CN' })
  ↓
localeToLang('zh-CN') → 'zh'
  ↓
后端接收 { lang: 'zh' }
  ↓
sceneRunner.getSceneConfig(..., locale: 'zh')
  ↓
选择 system_prompt_zh [❌ 错误]
```

---

## 📌 第六部分：配置与环境（Config & Env）

### 1. 当前使用的场景（Scene）加载顺序

| Scene Name | Prompt Path | 是否命中 |
|-----------|------------|---------|
| chat | `ai_scene_config.system_prompt_zh` | ✅ 始终命中（错误） |
| chat | `ai_scene_config.system_prompt_en` | ❌ 未命中 |
| chat | `ai_scene_config.system_prompt_ja` | ❌ 未命中 |

### 2. 当前 .env 中涉及本问题的变量

```
# AI Service 配置
AI_SERVICE_URL=http://localhost:8787
LOCAL_AI_SERVICE_URL=http://localhost:8787

# Supabase 配置（用于读取场景配置）
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
```

### 3. 数据库配置验证

✅ **已验证：** `system_prompt_ja` 和 `system_prompt_en` 在数据库中**存在且不为空**

---

## 📌 第七部分：问题影响范围（Impact Analysis）

### 影响哪些模块？
- ✅ **前端模块（web）:** `LanguageContext`, `AIPage`
- ✅ **AI服务模块（ai-service / local-ai-service）:** `ask.ts`, `sceneRunner.ts`

### 是否影响用户？
- ✅ **是** - 用户无法使用自己选择的语言与AI对话
- ✅ **用户体验严重受损** - 用户选择英文/日文，但AI始终用中文回复

### 是否影响管理员？
- ❌ **否** - 管理员功能不受影响

### 是否影响生产环境？
- ✅ **是** - 问题在生产环境中同样存在

### 是否影响积分/题库/AI调用等核心逻辑？
- ❌ **否** - 不影响核心业务逻辑，只影响AI回复语言

### 是否需紧急修复？
- ✅ **是** - High 优先级，影响用户体验

---

## 📌 第八部分：Cursor 自我分析（Root Cause Hypothesis）

### 根本原因分析

**主要问题：** `LanguageContext` 的初始状态硬编码为 `'zh'`，依赖异步 `useEffect` 从 localStorage 读取语言设置。在用户快速发送消息时，`useEffect` 可能还未执行完成，导致 `language` 仍然是初始值 `'zh'`。

### 可能原因列表

1. ✅ **LanguageContext 初始化时机问题（最可能）**
   - `useState<Language>('zh')` 硬编码初始值
   - `useEffect` 异步执行，存在竞态条件
   - 用户在 `useEffect` 执行前发送消息，获取到的是初始值 `'zh'`

2. ✅ **React 渲染时机问题**
   - SSR/CSR 不匹配导致初始值固定为 `'zh'`
   - 客户端 hydration 时，`useEffect` 还未执行

3. ⚠️ **localStorage 读取延迟**
   - `localStorage.getItem` 虽然是同步的，但在 `useEffect` 中执行
   - 如果组件在 `useEffect` 执行前就使用了 `language`，会获取到错误值

4. ⚠️ **Context 更新延迟**
   - Context 值更新后，依赖该值的组件可能还未重新渲染
   - `handleSend` 的依赖项 `language` 可能不是最新值

5. ❌ **后端语言解析错误（已排除）**
   - 后端 `parseAndValidateBody` 和 `sceneRunner` 逻辑正确
   - 问题在前端语言传递环节

6. ❌ **数据库 prompt 缺失（已排除）**
   - 已验证 `system_prompt_ja` 和 `system_prompt_en` 存在且不为空

---

## 📌 第九部分：建议修复方向（Suggested Fixes）

### ✔ 方案 A（推荐 - 最安全）：在 LanguageContext 初始化时同步读取 localStorage

**优点：**
- 解决根本问题
- 不影响现有代码结构
- 保持 SSR/CSR 兼容性

**实现：**
```typescript
export function LanguageProvider({ children }: { children: ReactNode }) {
  // ✅ 修复：在初始化时同步读取 localStorage（仅在客户端）
  const getInitialLanguage = (): Language => {
    if (typeof window === 'undefined') {
      return 'zh'; // SSR 默认返回中文
    }
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null;
    if (saved && ['zh', 'en', 'ja'].includes(saved)) {
      return saved;
    }
    // 如果没有保存的语言，尝试从浏览器语言检测
    const browserLang = navigator.language || navigator.languages?.[0] || 'zh';
    if (browserLang.startsWith('ja')) {
      return 'ja';
    } else if (browserLang.startsWith('en')) {
      return 'en';
    }
    return 'zh';
  };

  const [language, setLanguageState] = useState<Language>(getInitialLanguage);
  
  // useEffect 仅用于处理运行时语言变更
  useEffect(() => {
    // ... 处理语言变更逻辑
  }, []);
}
```

### ✔ 方案 B（快速修复）：在 AIPage.handleSend 中直接读取 localStorage

**优点：**
- 快速修复，立即生效
- 不改变 Context 结构
- 确保获取最新值

**缺点：**
- 代码重复（localStorage 读取逻辑）
- 不是根本解决方案

**实现：**
```typescript
const handleSend = useCallback(async () => {
  // ...
  
  // ✅ 修复：直接从 localStorage 读取，确保获取最新值
  let currentLanguage: Language = language; // 先使用 Context 的值作为默认值
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('user-language') as Language | null;
    if (saved && ['zh', 'en', 'ja'].includes(saved)) {
      currentLanguage = saved;
    }
  }
  const userLocale = languageToLocale(currentLanguage);
  
  // ...
}, [/* dependencies */]);
```

### ✔ 方案 C（结构性改进）：使用 useSyncExternalStore Hook

**优点：**
- React 18 推荐的方式
- 自动同步外部存储（localStorage）
- 避免竞态条件

**缺点：**
- 需要 React 18+
- 代码改动较大

**实现：**
```typescript
import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function getSnapshot(): Language {
  if (typeof window === 'undefined') return 'zh';
  const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null;
  return (saved && ['zh', 'en', 'ja'].includes(saved)) ? saved : 'zh';
}

export function useLanguage() {
  const language = useSyncExternalStore(subscribe, getSnapshot);
  // ...
}
```

---

## 📌 第十部分：需要你（用户）决策的点（Decision Needed）

### 1. 修复方案选择
- [ ] **方案 A** - 推荐，解决根本问题
- [ ] **方案 B** - 快速修复，临时方案
- [ ] **方案 C** - 结构性改进，需要 React 18+

### 2. 是否需要测试验证
- [ ] 需要添加单元测试
- [ ] 需要添加集成测试
- [ ] 需要手动测试验证

### 3. 是否需要回滚方案
- [ ] 需要准备回滚方案
- [ ] 需要灰度发布

### 4. 其他考虑
- [ ] 是否需要同时修复其他语言相关的问题
- [ ] 是否需要优化语言切换的用户体验

---

## 📌 第十一部分：附录（Attachments）

### 1. 相关代码文件完整路径

```
/Users/leo/Desktop/v3/src/contexts/LanguageContext.tsx
/Users/leo/Desktop/v3/src/components/AIPage.tsx
/Users/leo/Desktop/v3/src/lib/aiClient.front.ts
/Users/leo/Desktop/v3/apps/ai-service/src/routes/ask.ts
/Users/leo/Desktop/v3/apps/ai-service/src/lib/sceneRunner.ts
/Users/leo/Desktop/v3/src/lib/i18n.ts
```

### 2. 关键函数签名

```typescript
// LanguageContext.tsx
export function LanguageProvider({ children }: { children: ReactNode }): JSX.Element
export function useLanguage(): LanguageContextType

// AIPage.tsx
function languageToLocale(lang: "zh" | "ja" | "en"): string
function localeToLang(locale: string | undefined): "zh" | "ja" | "en"
const handleSend: () => Promise<void>

// aiClient.front.ts
export async function callAiDirect(params: AiClientRequest): Promise<AiClientResponse>
function localeToLang(locale: string | undefined): "zh" | "ja" | "en"

// ask.ts
function parseAndValidateBody(body: unknown): { lang: string; ... }
export default async function askRoute(app: FastifyInstance): Promise<void>

// sceneRunner.ts
export async function getSceneConfig(...): Promise<SceneConfig | null>
export async function runScene(options: RunSceneOptions): Promise<SceneResult>
```

### 3. 数据流图

```
┌─────────────────┐
│ 用户选择语言 "en" │
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│ localStorage.setItem │
│ ('user-language',   │
│  'en')              │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ LanguageContext     │
│ useState('zh')      │ ❌ 问题：初始值硬编码
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ useEffect (异步)    │ ⚠️ 问题：可能还未执行
│ 读取 localStorage   │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ AIPage.useLanguage()│
│ language = 'zh'     │ ❌ 问题：仍然是初始值
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ languageToLocale()  │
│ 'zh' → 'zh-CN'     │ ❌ 错误转换
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ callAiDirect()      │
│ locale: 'zh-CN'    │ ❌ 传递错误值
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ ai-service          │
│ lang: 'zh'          │ ❌ 接收到错误值
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ sceneRunner         │
│ 选择中文 prompt     │ ❌ 错误选择
└─────────────────────┘
```

### 4. 之前采取过的措施

1. ✅ **已验证数据库配置**
   - 确认 `system_prompt_ja` 和 `system_prompt_en` 存在且不为空

2. ✅ **已查看 local-ai-service 日志**
   - 确认接收到的是 `zh` 的 locale，而不是用户选择的 `en`

3. ✅ **已追踪代码流程**
   - 从 `AIPage` → `aiClient.front` → `ask.ts` → `sceneRunner.ts`
   - 确认问题出在前端语言传递环节

4. ⚠️ **已尝试修复（但被撤销）**
   - 用户尝试在 `LanguageContext` 初始化时同步读取 localStorage
   - 但担心 SSR/CSR 不匹配问题，撤销了修改

---

## 📌 总结

**问题根源：** `LanguageContext` 的初始状态硬编码为 `'zh'`，依赖异步 `useEffect` 从 localStorage 读取语言设置。在用户快速发送消息时，`useEffect` 可能还未执行完成，导致 `language` 仍然是初始值 `'zh'`。

**推荐修复方案：** 方案 A - 在 `LanguageContext` 初始化时同步读取 localStorage（仅在客户端），同时保持 SSR/CSR 兼容性。

**优先级：** High - 影响用户体验，需要尽快修复。

---

**报告结束**

