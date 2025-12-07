# 任务执行报告

## 任务标题
[Auth] 统一优化 LINE / Twitter 首次邮箱绑定后的登录闭环 —— 改为“绑定成功 → 回登录页提示，再次点击登录”

## 规范边界
- 范围：仅调整 bind-email 成功后的跳转与 /login 提示文案
- 保持：Google 行为不变；Adapter 幂等、DB 结构与类型不变；`/api/auth/[...nextauth]` 仅分发
- 单一事实来源：`users.email` 唯一身份；`oauth_accounts` 统一通过 Adapter 写入

## 修改文件列表
- `src/app/api/auth/bind-email/route.ts`
  - 对 `provider in {line, twitter}`：成功绑定后重定向到 `/login?bind={provider}_success&email={normalizedEmail}`
  - 其他 provider（如 Google）：保持原逻辑，重定向到 `/api/auth/signin/{provider}`
- `src/app/login/page.tsx`
  - 读取 `bind` 与 `email` 参数
  - 在登录卡片顶部显示成功提示块：指导用户再次点击对应第三方登录完成闭环

## 关键逻辑说明
- 成功绑定后不自动二次登录，避免首次 re-signin 的不稳定风险（尤其 Twitter）
- 将闭环交由用户在登录页再次点击对应按钮完成，提升稳定性

## 自测场景与结果
- LINE 无邮箱 → 绑定已有 Gmail → 再次登录
  - 绑定成功后跳转：`/login?bind=line_success&email=xxx@xxx`
  - 登录页提示可见；再次点击 LINE 登录 → 稳定成功；无通用错误页
  - SQL 验证：`users` 仅一条该邮箱；`oauth_accounts` 存在 `provider='line'` 且指向同一 `users.id`
- Twitter 无邮箱 → 同步验证
  - 绑定成功后跳转：`/login?bind=twitter_success&email=xxx@xxx`
  - 再次点击 Twitter 登录 → 稳定成功；无 “private 模式”错误
- 回归：Google & 有邮箱的 LINE/Twitter
  - Google 行为未改变
  - LINE/Twitter 若自身带邮箱则不走 email-binding，按邮箱归拢

## SQL 验证示例
- `SELECT id, email FROM users WHERE LOWER(email) = LOWER('xxx@xxx');`
- `SELECT provider, provider_account_id, user_id FROM oauth_accounts WHERE user_id = '<users.id>';`

## 构建与提交
- 本地构建成功
- 已推送到 `main`
- 提交编号：`6561cfb9d102407b9e0bf63795c34886e366a51f`

## 结论
- LINE / Twitter 首次绑定后的登录闭环改为“回登录页提示 + 二次点击完成”，稳定性提升，保持统一认证体系不变。
