# 移动 App 打包指南 - iOS & Android

**项目**: ZALEM 驾考学习应用  
**技术栈**: Next.js 15 + React 18 + TypeScript  
**目标平台**: iOS App Store & Google Play Store

---

## 📋 目录

1. [技术方案选择](#技术方案选择)
2. [准备工作](#准备工作)
3. [实施步骤](#实施步骤)
4. [平台特定配置](#平台特定配置)
5. [测试与发布](#测试与发布)
6. [成本与时间估算](#成本与时间估算)

---

## 🎯 技术方案选择

### 推荐方案：Capacitor + PWA 优化

**为什么选择 Capacitor？**
- ✅ 保留现有 Next.js 代码，无需重写
- ✅ 支持原生功能（推送通知、相机、文件系统等）
- ✅ 跨平台开发（iOS + Android）
- ✅ 性能接近原生 App
- ✅ 可以逐步添加原生功能

**架构流程：**
```
Next.js Web App → PWA 优化 → Capacitor 打包 → iOS/Android App
```

### 备选方案对比

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| **Capacitor** ⭐ | 保留现有代码，支持原生功能 | 需要配置原生环境 | **推荐使用** |
| React Native | 性能好，原生体验 | 需要重构大量代码 | 不适合（代码量大） |
| PWA | 实现简单 | 功能受限，不支持 App Store | 仅作为过渡 |
| Cordova | 生态成熟 | 性能一般，维护较少 | 不推荐 |

---

## 🛠️ 准备工作

### 1. 开发环境要求

#### iOS 开发
- **macOS**（必须，无法在 Windows/Linux 开发 iOS）
- **Xcode**（最新版本，从 App Store 下载）
- **CocoaPods**：`sudo gem install cocoapods`
- **Apple Developer Account**（年费 $99）
  - 个人账号：只能发布到 App Store
  - 企业账号：可内部分发（需要额外费用）

#### Android 开发
- **Android Studio**（从官网下载）
- **Java JDK 17+**
- **Android SDK**
- **Google Play Developer Account**（一次性费用 $25）

#### 通用工具
- **Node.js 18+**
- **npm/yarn**
- **Git**

### 2. 项目依赖检查

检查当前项目是否有不适合移动端的依赖：
- ✅ `next`: 支持 SSR，移动端可用
- ✅ `react`: 兼容
- ✅ `lucide-react`: 图标库，兼容
- ⚠️ `pg`: 数据库连接 - 移动端需改为 API 调用
- ✅ `tailwindcss`: 响应式，完美适配

---

## 📦 实施步骤

### 阶段 1: PWA 优化（推荐先完成）

#### 1.1 添加 PWA 配置

```bash
npm install next-pwa
```

创建 `next.config.js` 更新：

```javascript
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
});

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
      },
    ],
  },
};

module.exports = withPWA(nextConfig);
```

#### 1.2 创建 Web App Manifest

创建 `public/manifest.json`：

```json
{
  "name": "ZALEM 驾考学习",
  "short_name": "ZALEM",
  "description": "驾考学习应用",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563eb",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

#### 1.3 准备应用图标

需要准备以下尺寸的图标（放在 `public/` 目录）：
- `icon-192x192.png`
- `icon-512x512.png`
- `apple-touch-icon.png` (180x180)

#### 1.4 更新 layout.tsx

在 `src/app/layout.tsx` 中添加 manifest 链接：

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2563eb" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

---

### 阶段 2: 安装和配置 Capacitor

#### 2.1 安装 Capacitor

```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios @capacitor/android
npx cap init
```

初始化时会询问：
- **App name**: ZALEM
- **App ID**: com.zalem.app (必须小写，唯一标识)
- **Web dir**: `.next` (Next.js 输出目录)

#### 2.2 更新 capacitor.config.ts

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zalem.app',
  appName: 'ZALEM',
  webDir: '.next',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    // 开发时可以指向本地服务器
    // url: 'http://localhost:3000',
    // cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#2563eb',
      showSpinner: false,
    },
    StatusBar: {
      style: 'light',
      backgroundColor: '#2563eb',
    },
  },
};

export default config;
```

#### 2.3 修改 Next.js 构建输出

更新 `next.config.js` 确保静态输出：

```javascript
// 如果使用静态导出
const nextConfig = {
  output: 'export', // 注意：这会禁用 SSR/API 路由
  // 或者使用 standalone 模式
  output: 'standalone',
  // ...
};
```

**⚠️ 重要：** 如果使用静态导出，需要将 API 路由移到外部服务。

**推荐方案：** 使用 Vercel/其他服务器托管 API，移动端通过 HTTPS 访问。

---

### 阶段 3: 移动端适配

#### 3.1 添加 Capacitor 原生功能插件

```bash
npm install @capacitor/app
npm install @capacitor/status-bar
npm install @capacitor/splash-screen
npm install @capacitor/keyboard
npm install @capacitor/preferences
```

#### 3.2 创建移动端工具文件

创建 `src/lib/mobile.ts`：

```typescript
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { App } from '@capacitor/app';

export const isMobileApp = Capacitor.isNativePlatform();

export async function initMobileApp() {
  if (isMobileApp) {
    // 设置状态栏
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: '#2563eb' });

    // 监听返回按钮（Android）
    App.addListener('backButton', ({ canGoBack }) => {
      if (!canGoBack) {
        App.exitApp();
      } else {
        window.history.back();
      }
    });
  }
}
```

#### 3.3 更新主 layout

在 `src/app/layout.tsx` 中调用初始化：

```tsx
'use client';

import { useEffect } from 'react';
import { initMobileApp } from '@/lib/mobile';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initMobileApp();
  }, []);

  return (
    <html lang="zh-CN">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        {/* ... */}
      </head>
      <body>{children}</body>
    </html>
  );
}
```

#### 3.4 修复移动端 API 调用

更新 API 基础 URL（如果部署在不同服务器）：

创建 `src/lib/apiConfig.ts`：

```typescript
import { Capacitor } from '@capacitor/core';

// 开发环境
const DEV_API_URL = 'http://localhost:3000';

// 生产环境（Vercel）
const PROD_API_URL = 'https://drivequiz20251102-app.vercel.app';

// 移动端使用外部 API，Web 端使用相对路径
export const getApiBaseUrl = () => {
  if (process.env.NODE_ENV === 'development') {
    return Capacitor.isNativePlatform() ? DEV_API_URL : '';
  }
  return Capacitor.isNativePlatform() ? PROD_API_URL : '';
};
```

---

### 阶段 4: iOS 配置

#### 4.1 添加 iOS 平台

```bash
npx cap add ios
npx cap sync
```

#### 4.2 配置 iOS 项目

打开 Xcode 项目：
```bash
npx cap open ios
```

#### 4.3 设置应用信息

在 Xcode 中：
1. **General** 标签页：
   - Display Name: `ZALEM`
   - Bundle Identifier: `com.zalem.app`
   - Version: `1.0.0`
   - Build: `1`

2. **Signing & Capabilities**：
   - 选择 Team（需要 Apple Developer 账号）
   - 启用所需功能（如推送通知等）

#### 4.4 配置 Info.plist

添加必要的权限和配置：

```xml
<!-- 允许 HTTP（开发用，生产环境建议移除） -->
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsArbitraryLoads</key>
  <false/>
</dict>

<!-- 网络权限 -->
<key>NSNetworkVolumesUsageDescription</key>
<string>需要访问网络以获取学习内容</string>

<!-- 如果需要相机（未来功能） -->
<key>NSCameraUsageDescription</key>
<string>需要相机权限以拍照上传</string>
```

#### 4.5 准备启动画面和图标

在 Xcode 中：
1. 打开 `ios/App/App.xcassets`
2. 添加应用图标（需要多个尺寸）
3. 添加启动画面

#### 4.6 构建和测试

```bash
# 同步代码到 iOS
npx cap sync ios

# 在 Xcode 中：
# Product → Destination → Choose a device/simulator
# Product → Run (Cmd+R)
```

---

### 阶段 5: Android 配置

#### 5.1 添加 Android 平台

```bash
npx cap add android
npx cap sync
```

#### 5.2 配置 Android 项目

打开 Android Studio：
```bash
npx cap open android
```

#### 5.3 设置应用信息

在 `android/app/build.gradle`：

```gradle
android {
    defaultConfig {
        applicationId "com.zalem.app"
        minSdkVersion 22
        targetSdkVersion 34
        versionCode 1
        versionName "1.0.0"
    }
}
```

#### 5.4 配置 AndroidManifest.xml

在 `android/app/src/main/AndroidManifest.xml`：

```xml
<manifest>
    <!-- 网络权限 -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:usesCleartextTraffic="false"
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:label="ZALEM">
        <!-- ... -->
    </application>
</manifest>
```

#### 5.5 准备图标和启动画面

在 Android Studio 中：
1. 右键 `res` → New → Image Asset
2. 生成所有尺寸的图标
3. 设置启动画面

#### 5.6 构建和测试

```bash
# 同步代码到 Android
npx cap sync android

# 在 Android Studio 中：
# Run → Run 'app'
```

---

## 🚀 发布流程

### iOS 发布到 App Store

#### 1. 准备工作
- ✅ Apple Developer 账号（年费 $99）
- ✅ 完成应用测试
- ✅ 准备应用截图和描述
- ✅ 准备隐私政策 URL

#### 2. 构建 Archive

在 Xcode 中：
1. **Product** → **Scheme** → **Edit Scheme**
2. 选择 **Release** 配置
3. **Product** → **Archive**
4. 等待构建完成

#### 3. 提交审核

1. 打开 **Organizer**（Window → Organizer）
2. 选择 Archive → **Distribute App**
3. 选择 **App Store Connect**
4. 选择分发方式：
   - **Upload**：直接上传
   - **Export**：导出后手动上传
5. 填写必要信息
6. 提交审核

#### 4. App Store Connect 配置

在 [App Store Connect](https://appstoreconnect.apple.com)：
1. 创建新应用
2. 填写应用信息：
   - 名称、副标题
   - 分类
   - 价格（免费或收费）
   - 年龄分级
   - 隐私政策 URL
3. 上传截图（必需尺寸）：
   - iPhone 6.7" 显示屏（1290 x 2796）
   - iPhone 6.5" 显示屏（1242 x 2688）
   - iPhone 5.5" 显示屏（1242 x 2208）
4. 填写应用描述
5. 提交审核

#### 5. 审核时间

- 首次提交：通常 1-3 天
- 更新：通常 24-48 小时
- 如果被拒，修复后重新提交

---

### Android 发布到 Google Play

#### 1. 准备工作
- ✅ Google Play Developer 账号（一次性 $25）
- ✅ 完成应用测试
- ✅ 准备应用截图和描述
- ✅ 准备隐私政策 URL

#### 2. 生成签名密钥

```bash
keytool -genkey -v -keystore zalem-release-key.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias zalem
```

**⚠️ 重要：** 妥善保管密钥文件，丢失将无法更新应用。

#### 3. 配置签名

在 `android/app/build.gradle`：

```gradle
android {
    signingConfigs {
        release {
            storeFile file('../zalem-release-key.jks')
            storePassword 'YOUR_STORE_PASSWORD'
            keyAlias 'zalem'
            keyPassword 'YOUR_KEY_PASSWORD'
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

#### 4. 构建 Release APK/AAB

```bash
cd android
./gradlew assembleRelease  # 生成 APK
# 或
./gradlew bundleRelease     # 生成 AAB（推荐，Google Play 要求）
```

输出位置：`android/app/build/outputs/bundle/release/app-release.aab`

#### 5. Google Play Console 配置

在 [Google Play Console](https://play.google.com/console)：
1. 创建新应用
2. 填写应用信息：
   - 名称、简短描述、完整描述
   - 分类
   - 目标受众和内容分级
   - 隐私政策 URL
3. 上传截图（必需）：
   - 手机：至少 2 张（最大 8 张）
   - 平板：至少 1 张（如果有支持）
   - 最小尺寸：320px
   - 最大尺寸：3840px
4. 上传应用包（AAB 文件）
5. 填写商店列表信息
6. 提交审核

#### 6. 审核时间

- 首次提交：通常 1-7 天
- 更新：通常几小时到 1 天

---

## 📱 平台特定配置

### iOS 特定配置

#### App Store 必需信息

1. **应用图标**（所有必需尺寸）：
   - 20pt × 20pt (1x, 2x, 3x)
   - 29pt × 29pt (1x, 2x, 3x)
   - 40pt × 40pt (1x, 2x, 3x)
   - 60pt × 60pt (2x, 3x)
   - 1024pt × 1024pt (1x)

2. **启动画面**：
   - 推荐使用 Storyboard
   - 或静态图片

3. **隐私权限说明**：
   - 必须在 Info.plist 声明所有使用的权限
   - 在 App Store Connect 说明使用原因

#### 常见问题

**问题 1：API 路由不可用**
- 解决：将所有 API 移到外部服务器（Vercel/其他）
- 移动端通过 HTTPS 访问外部 API

**问题 2：图片加载慢**
- 解决：使用 Next.js Image 组件的优化
- 考虑使用 CDN

**问题 3：白屏或错误**
- 检查：控制台日志
- 解决：确保 API 基础 URL 正确

### Android 特定配置

#### Google Play 必需信息

1. **应用图标**：
   - 至少需要 48dp × 48dp（MDPI）
   - 建议准备所有密度版本

2. **功能权限**：
   - 在 AndroidManifest.xml 中声明
   - 运行时权限（Android 6.0+）需要用户授权

3. **目标 SDK 版本**：
   - 建议使用最新稳定版本
   - 目前推荐：API 34 (Android 14)

#### 常见问题

**问题 1：网络请求失败**
- 检查：网络权限是否已添加
- 解决：确保使用 HTTPS

**问题 2：应用崩溃**
- 检查：Logcat 日志
- 解决：确保所有原生插件正确初始化

---

## 🧪 测试清单

### 功能测试

- [ ] 应用启动正常
- [ ] 激活流程正常
- [ ] 学习功能正常
- [ ] 考试功能正常
- [ ] 错题本功能正常
- [ ] 个人中心正常
- [ ] 网络请求正常（所有 API）
- [ ] 离线功能（如果有）
- [ ] 返回按钮（Android）正常

### 兼容性测试

- [ ] iOS 13+ 设备
- [ ] Android 5.0+ (API 22+) 设备
- [ ] 不同屏幕尺寸（iPhone SE 到 iPad Pro）
- [ ] 横屏和竖屏切换
- [ ] 深色模式（如果支持）

### 性能测试

- [ ] 启动时间 < 3 秒
- [ ] 页面切换流畅
- [ ] 图片加载优化
- [ ] 内存使用合理

### 安全测试

- [ ] HTTPS 连接
- [ ] 敏感数据加密
- [ ] 输入验证
- [ ] 权限请求合理

---

## 💰 成本与时间估算

### 开发成本

| 项目 | 成本 | 说明 |
|------|------|------|
| Apple Developer | $99/年 | iOS 发布必需 |
| Google Play | $25/一次性 | Android 发布必需 |
| **总计** | **$124** | 首次 + $99/年续费 |

### 时间估算

| 阶段 | 预计时间 | 说明 |
|------|----------|------|
| PWA 优化 | 1-2 天 | 配置 manifest、图标等 |
| Capacitor 集成 | 2-3 天 | 安装配置、移动端适配 |
| iOS 配置 | 2-3 天 | Xcode 配置、测试、调试 |
| Android 配置 | 2-3 天 | Android Studio 配置、测试 |
| API 迁移（如需要） | 3-5 天 | 如果要将 API 移到外部服务 |
| 测试与修复 | 3-5 天 | 功能测试、兼容性测试 |
| App Store 提审准备 | 1-2 天 | 截图、描述、隐私政策 |
| **总计** | **14-23 天** | 约 2-3 周（全职开发） |

### 持续维护

- 每月更新：1-3 天
- 修复问题：按需
- App Store 审核：每次 1-3 天
- Google Play 审核：每次几小时到 1 天

---

## 📝 检查清单

### 发布前检查

#### 代码层面
- [ ] 移除所有 console.log（或使用生产环境配置）
- [ ] 移除测试数据和调试代码
- [ ] 确保所有 API 使用 HTTPS
- [ ] 验证错误处理完整
- [ ] 检查性能优化（图片、代码分割）

#### 配置层面
- [ ] 应用图标和启动画面已设置
- [ ] 应用名称和版本号正确
- [ ] Bundle ID/Package Name 唯一且正确
- [ ] 权限声明完整且必要
- [ ] 隐私政策 URL 可访问

#### 内容层面
- [ ] 应用截图已准备（所有必需尺寸）
- [ ] 应用描述完整且准确
- [ ] 关键词优化（App Store）
- [ ] 年龄分级正确
- [ ] 分类选择合适

#### 测试层面
- [ ] 在真实设备上测试（非模拟器）
- [ ] 测试不同网络环境（WiFi、4G、5G）
- [ ] 测试低端设备
- [ ] 测试所有主要功能
- [ ] 崩溃报告已配置（推荐使用 Sentry）

---

## 🎯 推荐实施顺序

### 第 1 周：基础准备
1. ✅ 完成 PWA 配置
2. ✅ 安装和配置 Capacitor
3. ✅ 准备应用图标和启动画面
4. ✅ 修复移动端 API 调用

### 第 2 周：平台配置
1. ✅ iOS 项目配置和测试
2. ✅ Android 项目配置和测试
3. ✅ 移动端适配优化
4. ✅ 功能测试和修复

### 第 3 周：发布准备
1. ✅ 准备 App Store 材料（截图、描述）
2. ✅ 准备 Google Play 材料
3. ✅ 最终测试和优化
4. ✅ 提交审核

---

## 📚 参考资源

### 官方文档
- [Capacitor 文档](https://capacitorjs.com/docs)
- [Next.js 部署文档](https://nextjs.org/docs/deployment)
- [Apple App Store 指南](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play 政策](https://play.google.com/about/developer-content-policy/)

### 工具和服务
- **Sentry**: 崩溃报告和错误监控
- **Firebase**: 推送通知、分析（可选）
- **Fastlane**: 自动化 iOS/Android 发布流程
- **App Store Connect API**: 自动化提审

### 社区资源
- [Capacitor 论坛](https://forum.ionicframework.com/c/capacitor/)
- [Next.js Discord](https://nextjs.org/discord)
- Stack Overflow

---

## ⚠️ 注意事项

### 重要提醒

1. **API 路由问题**：
   - Next.js API 路由在移动端不可用
   - 需要将 API 部署到外部服务器（如 Vercel）
   - 移动端通过 HTTPS 访问外部 API

2. **数据存储**：
   - localStorage 在移动端可用
   - 考虑使用 Capacitor Preferences 插件
   - 敏感数据需要加密

3. **性能优化**：
   - 图片使用 Next.js Image 组件
   - 代码分割和懒加载
   - 减少首屏加载时间

4. **审核注意**：
   - 遵循各平台的政策和指南
   - 准备隐私政策
   - 确保内容合规

---

## 🚨 常见错误和解决方案

### 错误 1: "API route not found"
**原因**: Next.js API 路由在移动端不可用  
**解决**: 将 API 部署到外部服务器，使用完整 URL

### 错误 2: "Network request failed"
**原因**: Android 默认不允许 HTTP，iOS 需要配置  
**解决**: 
- Android: 确保使用 HTTPS
- iOS: 配置 ATS（App Transport Security）

### 错误 3: "App crashes on launch"
**原因**: 插件初始化顺序问题  
**解决**: 检查 Capacitor 插件初始化顺序

### 错误 4: "White screen"
**原因**: 路径或资源加载错误  
**解决**: 检查控制台日志，确保所有资源路径正确

---

## ✅ 总结

打包移动 App 的主要步骤：

1. ✅ **PWA 优化**（1-2 天）
2. ✅ **Capacitor 集成**（2-3 天）
3. ✅ **iOS 配置**（2-3 天）
4. ✅ **Android 配置**（2-3 天）
5. ✅ **测试和修复**（3-5 天）
6. ✅ **发布准备**（1-2 天）
7. ✅ **提交审核**

**预计总时间**: 2-3 周（全职开发）

**成本**: $124（首次）+ $99/年（Apple Developer）

**推荐**: 先完成 iOS 或 Android 其中一个平台，验证流程后再做另一个平台。

---

**文档版本**: v1.0  
**最后更新**: 2025-11-06  
**维护者**: 开发团队

