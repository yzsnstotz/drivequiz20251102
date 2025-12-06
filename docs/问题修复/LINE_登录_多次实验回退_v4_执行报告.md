# LINE 登录多次实验回退到 v4 执行报告

## 规范对齐摘要
- 已阅读：`docs/🔧指令模版/修复指令头5.2（现用）.md`、`文件结构.md`、`数据库结构_DRIVEQUIZ.md`、`数据库结构_AI_SERVICE.md`
- 边界：本次仅操作 Git 历史与当前代码版本；不做业务逻辑修改、不做数据库迁移；不改动 ai-core / ai-service / local-ai-service；不修改 `src/lib/providers/line.ts`

## 目标
- 将 GitHub 上的 `main` 指向 v4 提交 `9167c4bb585ce4c2a10aaea1dd36b51322b535aa`，代码完全回到 v4 状态

## 1. 确认目标提交（v4）
- 命令：`git show 9167c4bb585ce4c2a10aaea1dd36b51322b535aa --stat --pretty=fuller`
- 结果：
  - Author: TraeDriveQuiz <nobuaki8366@gmail.com>
  - AuthorDate: 2025-12-07 03:40:22 +0900
  - Commit: TraeDriveQuiz <nobuaki8366@gmail.com>
  - CommitDate: 2025-12-07 03:40:22 +0900
  - Message: `fix(login-error): v4—统一将 error=Configuration 视为隐私/外部App导致的登录失败；移除对 code 的依赖与‘系统配置异常’文案；构建通过`
  - 说明：该提交为“iPhone_Private_模式_InvalidCheck_错误文案优化_v4”完成后的稳定状态

## 2. 备份当前（v8A 之后）main 状态
- 创建备份分支：`backup/2025-12-07_after-v8A`
- 创建 tag（可选）：`backup-after-v8A`
- 推送：
  - `git push origin backup/2025-12-07_after-v8A`
  - `git push origin backup-after-v8A`
- 说明：v5–v8 的改动仍可在备份分支/tag 找到，不会丢失

## 3. 强制回退 main 到 v4
- 本地重置：`git reset --hard 9167c4bb585ce4c2a10aaea1dd36b51322b535aa`
- 确认：`git log -1` 显示 `9167c4bb585ce4c2a10aaea1dd36b51322b535aa`
- 推送（强制）：`git push origin main --force-with-lease`
- 结果：远程 `main` 已回退到 v4；回退前后 HEAD 对比：`d4469c4... -> 9167c4b...`

## 4. 本地构建验证（基于 v4）
- 执行：`npm run build`
- 结果：构建成功；无新的 TypeScript/ESLint error（仅保留原有 warnings）

## 5. 上线验证要点
- Public 模式：LINE/Google/Phone 登录应恢复到 v4 的稳定表现；不出现 `InvalidCheck: state cookie was missing` 与 `INVALID_REQUEST: 'state' is not specified.`
- iPhone Safari Private 模式：行为回到 v4（可能提示 InvalidCheck），暂时接受；此回滚仅撤销 v5–v8 实验，不在此步修复 Private

## 6. 操作命令记录
- `git fetch origin && git checkout main && git pull origin main`
- `git show 9167c4bb585ce4c2a10aaea1dd36b51322b535aa --stat --pretty=fuller`
- `git branch backup/2025-12-07_after-v8A && git push origin backup/2025-12-07_after-v8A`
- `git tag backup-after-v8A && git push origin backup-after-v8A`
- `git reset --hard 9167c4bb585ce4c2a10aaea1dd36b51322b535aa`
- `git log -n 1 --pretty=oneline`
- `git push origin main --force-with-lease`
- `npm run build`

## 回退原因与后续建议
- 原因：v5–v8 的实验在生产引发私密模式提示问题与 Public 模式 LINE 登录能力下降，产品决定暂时全量回退到 v4 稳定版本
- 后续：如需重新设计 LINE + Private 模式兼容，另起版本（如 v9），基于 v4 稳定基线增量开发，而非继续在 v8 分叉版本叠加

— 完 —
