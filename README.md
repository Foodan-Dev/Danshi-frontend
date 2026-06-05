# 旦食前端 (Danshi Frontend)

旦食是一个校园美食分享与互动平台的前端应用，基于 Expo 与 React Native 构建，支持移动端与 Web 端多端运行。

## 📋 目录

- [技术栈](#技术栈)
- [项目架构](#项目架构)
- [功能特性](#功能特性)
- [快速开始](#快速开始)
- [环境配置](#环境配置)
- [分发与发布](#分发与发布)
- [开发指南](#开发指南)
- [相关文档](#相关文档)

## 🛠 技术栈

- **框架**: Expo + React Native
- **语言**: TypeScript
- **路由**: Expo Router
- **UI**: react-native-paper（Material 3）
- **状态/上下文**: React Context
- **网络层**: 统一 HTTP 客户端 + 鉴权客户端
- **存储**: AsyncStorage（Token/缓存）

## 🏗 项目架构

前端采用“分层 + 目录模块化”组织方式，核心分层自下而上如下：

- **Config & Constants**：配置与常量集中管理
- **Infra**：错误模型、HTTP 客户端、认证存储与权限工具
- **Repositories**：数据访问层，屏蔽 API/Mock/本地差异
- **Services**：用例服务层，输入校验与业务编排
- **Presentation**：Hooks / Context / Components / Screens / Routes

目录结构（节选）：

```
danshi/
├── src/
│   ├── app/                # 路由入口（Expo Router）
│   ├── screens/            # 页面级组件（绑定 Service/Context）
│   ├── components/         # 通用组件与 MD3 包装
│   ├── context/            # 全局状态与上下文（Auth/Theme/Notifications/Waterfall）
│   ├── hooks/              # 自定义 Hook（响应式/帖子操作/评论管理）
│   ├── services/           # 用例服务（校验/编排）
│   ├── repositories/       # 资源仓储（API/Mock 自动切换）
│   ├── lib/                # Infra：HTTP/Auth/Error/Theme
│   ├── models/             # 领域模型定义（User/Post/Comment/Stats）
│   ├── constants/          # 常量、配置与主题
│   └── utils/              # 工具函数（时间格式化/alert/转换器）
├── assets/                 # 静态资源
└── app.json                # Expo 配置
```

### 架构说明

- **Constants**: `src/constants/` 统一管理配置、开关、断点、主题、标签常量（原 `config/` 已合并至此）
- **Infra**: `src/lib/`（HTTP 客户端、鉴权与双 Token 刷新、错误模型、JWT 解析、动态主题色生成）
- **Repositories**: `src/repositories/` 提供资源级接口（Mock/Api 自动切换，9 个资源域）
- **Services**: `src/services/` 用例级校验与流程编排（10 个服务）
- **Presentation**: `src/app/` 路由入口、`src/screens/` 页面（17 个）、`src/components/` 组件、`src/context/` 全局状态、`src/hooks/` 自定义 Hook

## ✨ 功能特性

- 用户注册/登录与鉴权
- 帖子浏览、详情、创建与互动（点赞/收藏）
- 搜索、通知、关注与个人中心
- 主题切换与响应式布局
- Mock/Server 切换（`USE_MOCK`）

## 🚀 快速开始

### 前置要求

- Node.js 18+
- npm 或 pnpm
- 已安装 Expo Go（移动端调试）

### 安装步骤

1. **克隆项目**

```bash
git clone https://github.com/Danshi-FDU/Danshi-frontend.git
cd Danshi-frontend/danshi
```

2. **安装依赖**

```bash
npm install
```

3. **启动开发服务**

```bash
npm run start
```

或

```bash
npx expo start
```

4. **运行应用**

- **移动端**: 使用 Expo Go 扫描二维码
- **模拟器**: 选择 iOS/Android 模拟器运行
- **Web 端**: 在浏览器中访问 Expo Web

## ⚙️ 环境配置

1. **环境变量**

请参考 [danshi/.env.example](danshi/.env.example) 创建本地 `.env` 文件，重点配置：

- `EXPO_PUBLIC_API_URL`：后端 API 基地址
- `EXPO_PUBLIC_REQUEST_TIMEOUT_MS`：请求超时时间
- `EXPO_PUBLIC_USE_MOCK`：Mock 开关（true/false）

2. **Mock 与接口说明**

Mock/Server 切换与接口契约说明详见 [doc/Architecture/README.md](doc/Architecture/README.md)。

## 📦 分发与发布

本项目使用 Expo/EAS 进行多端分发。以下为常见发布流程：

### 应用标识与版本

- **应用名**：DanShi
- **slug**：DanShi
- **版本**：0.3.0
- **iOS Bundle ID**：com.fdueat.danshi
- **Android Package**：com.fdueat.DanShi
- **Web 输出**：static
- **EAS Project ID**：d7bd18a3-1439-434c-8c64-9f8f37e54a74
- **Owner**：danshi-cslg

如需修改发布信息，请同步更新 [danshi/app.json](danshi/app.json) 与相关分发流程。

### EAS Build Profiles

**iOS**

| Profile | distribution | 用途 |
|---------|-------------|------|
| `preview` | `internal` | Ad Hoc 分发（需要 UDID） |
| `testflight` | `store` | TestFlight 测试分发 |
| `production` | `store` | App Store 正式发布 |

**Android**

| Profile | buildType | npm 脚本 | 用途 |
|---------|-----------|----------|------|
| `preview` | `apk` | `npm run build:apk` | 直接安装 |
| `production` | `apk` | `npm run build:aab` | 生产发布 |

#### iOS TestFlight 发布流程

本项目已在 [danshi/eas.json.example](danshi/eas.json.example) 中配置了专用的 `testflight` profile（`distribution=store`），用于 TestFlight 分发。

首先讲一下本项目 testflight 分发的步骤：
eas打包-> app connect 认证 -> testflight 认证并分发
你需要先登录 eas 和 apple 账号

```bash
# 第一步：构建
npm run build:ios:testflight

# 第二步：提交到 App Store Connect
npm run submit:ios:testflight

# 或者一步完成构建和提交
npm run build:submit:ios:testflight
```

然后在 [App Store Connect](https://appstoreconnect.apple.com) → TestFlight 页面选择内部测试/外部测试分发。

**前置条件**

- Apple ID 必须属于某个 **Team**，且该 Team 具有 **付费 Apple Developer Program** 会员资格
- `ios.bundleIdentifier` 必须与 App Store Connect 中创建的 App 的 Bundle ID 一致
- App Store Connect 需要有足够权限（"App 管理"通常足够）

**首次使用详细步骤**

1. 确认 `danshi/eas.json` 文件存在（参照 `eas.json.example` 创建），确保 `testflight` profile 中的后端地址正确

2. 登录 EAS 和配置提交凭证：

```bash
npm install
npm run eas:login
```

3. 构建并提交（首次提交会进入交互式配置，可选择 API Key 或 Apple ID）：

```bash
npm run build:ios:testflight
npm run submit:ios:testflight
```

4. 在 App Store Connect 发放 TestFlight：
   - 等待构建处理完成（约 10-30 分钟）
   - **Internal Testing**：团队内部（最多 100 人），无需审核
   - **External Testing**：外部测试员（最多 10,000 人），首次需要 Beta App Review

**推荐：使用 API Key 提交（避免 2FA 问题）**

1) App Store Connect → Users and Access → Keys
2) 创建 API Key（角色建议 `App Manager`）
3) 下载 `.p8` 文件，记下 `Key ID` 和 `Issuer ID`
4) 首次运行 `submit` 命令时选择使用 API Key


### 3. Web 分发

```bash
npx expo export --platform web
```

生成的静态文件位于 dist/，可部署到任意静态托管服务。

## 🧭 开发指南

- 统一使用 `services` 与 `repositories` 进行业务与接口拆分
- 新页面优先使用 Expo Router 的文件路由约定
- 组件样式优先使用主题与常量，避免硬编码
- 读操作走未鉴权 HTTP 客户端，写操作走鉴权客户端

## 📚 相关文档

- [doc/Architecture/README.md](doc/Architecture/README.md)
- [Expo Documentation](https://docs.expo.dev/)
