# 项目架构说明（DanShi）

> 最新修改日期：2026-05-07

---

## 目录

1. [总览](#1-总览overview)
2. [目录结构](#2-目录结构按功能与分层说明)
3. [分层架构详解](#3-分层架构详解职责依赖与边界)
4. [HTTP 与错误处理](#4-http-与错误处理统一约定)
5. [认证与权限](#5-认证与权限auth--roles)
6. [Mock / Server 切换](#6-mock--server-切换操作指南)
7. [主题与设计系统](#7-主题与设计系统theme--ds)
8. [响应式系统](#8-响应式系统responsive)
9. [页面与路由](#9-页面与路由screens--expo-router)
10. [数据模型与存储](#10-数据模型与存储models--storage)
11. [开发约定与风格指南](#11-开发约定与风格指南)
12. [目录与文件清单](#12-目录与文件清单逐项说明)

---

## 1. 总览（Overview）

本项目是基于 Expo + React Native（TypeScript）的校园美食分享与互动平台移动应用，支持 iOS、Android 与 Web 三端。

- 核心分层（自下而上）：
  - **Constants（常量与配置）**：集中管理环境变量、运行时开关、常量定义，避免散落硬编码
  - **Infra（基础设施层）**：错误模型、HTTP 客户端、认证存储、权限工具、主题色生成器
  - **Data Sources & Repositories（数据访问层）**：统一对外的资源访问接口（API / Mock），按资源域（auth、posts、comments、users、notifications、search、admin、uploads、stats）组织
  - **Services（领域服务层）**：业务校验与编排，面向用例而非数据表
  - **Presentation（表现层）**：Hook、Context、组件（基于 Material 3）、屏幕、导航与主题系统

---

## 2. 目录结构（按功能与分层说明）

以下说明按 `danshi/src/` 下的目录进行，逐一列出用途与文件职责。

### 2.1 constants/

集中式常量、配置与运行时开关。

- `src/constants/app.ts`
  - 运行时配置与开关（原 `config/index.ts` 已合并至此）：
    - `USE_MOCK`（切换 Mock/Server，来源 `EXPO_PUBLIC_USE_MOCK`）
    - `API_BASE_URL`（服务端 URL，来源 `EXPO_PUBLIC_API_URL`）
    - `REQUEST_TIMEOUT_MS`（请求超时，来源 `EXPO_PUBLIC_REQUEST_TIMEOUT_MS`）
  - `STORAGE_KEYS`：`AUTH_TOKEN`、`REFRESH_TOKEN`、`POSTS` 等存储键
  - `API_ENDPOINTS`：所有 API 路径常量（按 AUTH / USERS / ADMIN / POSTS / COMMENTS / SEARCH / NOTIFICATIONS 分组）
  - `ROLES`、`ROLE_ORDER`：角色常量与优先级序列
  - `REGEX`：邮箱与用户名校验正则

- `src/constants/breakpoints.ts`
  - 断点定义与工具：
    - `breakpoints`：`{ sm: 640, md: 768, lg: 1024, xl: 1280 }`
    - `Breakpoint` / `BreakpointKey` 类型
    - `BREAKPOINT_ORDER`：`['base', 'sm', 'md', 'lg', 'xl']`
    - `pickByBreakpoint(current, map)`：根据当前断点选择值，缺省回退至更小断点或 base

- `src/constants/layout.ts`
  - 主题设计系统常量：`Spacing`（xs~xxl 间距刻度）、`Fonts`（跨平台字体族）、`TypeScale`（不同断点下标题/正文字号）

- `src/constants/md3_theme.ts`
  - MD3 主题构建与扩展：
    - `SemanticColors` 接口：推荐（绿）、避雷（红）、求助（紫）的语义颜色定义
    - `ExtendedMD3Theme` 类型：`MD3Theme` + `SemanticColors`
    - `getMD3Theme(mode, accentColor?)`：生成 MD3 主题（支持自定义主色调 + Material Color Utilities 动态调色板）
    - `useExtendedTheme()` Hook：类型安全地获取包含语义颜色的主题，替代 `usePaperTheme()` + `as any` 模式

- `src/constants/post_labels.ts`
  - 帖子展示相关公共常量：
    - `TYPE_LABEL`：帖子类型中文标签（`share → 分享`、`seeking → 求助`）
    - `SHARE_LABEL`：分享子类型中文标签（`recommend → 推荐`、`warning → 避雷`）
    - `LoaderState` 类型：列表/详情页通用加载状态

- `src/constants/selects.ts`
  - 下拉选项常量：`HOMETOWN_OPTIONS`、`CANTEEN_OPTIONS`、`findOptionLabel()`

- `src/constants/theme.ts`
  - 默认主题色设计（品牌色定义）

### 2.2 lib/

跨域基础设施，不涉及业务逻辑。

- **HTTP 客户端**
  - `src/lib/http/client.ts`：基础 HTTP 客户端封装（统一超时、JSON 解析、错误映射），导出 `http` 单例
  - `src/lib/http/http_auth.ts`：鉴权版 HTTP 客户端，自动注入 `Authorization` 头，内置双 Token 自动刷新机制（401 检测 → refresh → 重试），导出 `httpAuth` 单例
  - `src/lib/http/response.ts`：统一 API 响应模型 `ApiResponse<T>` 与解包器 `unwrapApiResponse()`

- **错误处理**
  - `src/lib/errors/app_error.ts`：统一错误类 `AppError`（含 `status`、`code`、`cause`），提供 `static from()` 归一化工具

- **认证**
  - `src/lib/auth/auth_storage.ts`：基于 AsyncStorage 的 Token 持久化（`getToken/setToken/clearToken`、`getRefreshToken/setRefreshToken/clearRefreshToken`）
  - `src/lib/auth/jwt.ts`：轻量 JWT Payload 解码（Base64url 解析，不校验签名），用于登录后立即提取 `name`/`avatarUrl` 预览
  - `src/lib/auth/roles.ts`：角色判定工具（`hasRoleAtLeast()`、`isAdmin()`、`isSuperAdmin()`）

- **主题色生成**
  - `src/lib/theme/color_generator.ts`：基于 Material Color Utilities 的动态调色板生成器，从用户选择的种子色生成完整 MD3 色彩系统

### 2.3 repositories/

以"资源"为单位，提供稳定的读写接口；屏蔽数据源差异（API / Mock）。

| 文件 | 资源域 | 实现 | 说明 |
|------|--------|------|------|
| `auth_repository.ts` | 认证 | Mock + Api | 登录/注册/刷新，`USE_MOCK` 自动切换 |
| `posts_repository.ts` | 帖子 | Mock + Api | 列表/详情/CRUD/点赞/收藏/状态，读走 `http`，写走 `httpAuth` |
| `comments_repository.ts` | 评论 | Mock + Api | 评论列表/回复/创建/点赞/删除 |
| `users_repository.ts` | 用户 | Mock + Api | 用户信息/帖子/收藏/关注/粉丝 |
| `notifications_repository.ts` | 通知 | Api only | 通知列表/未读数/标记已读 |
| `search_repository.ts` | 搜索 | Api only | 帖子搜索/用户搜索 |
| `admin_repository.ts` | 管理 | Api only | 帖子审核/用户管理/评论管理/管理员列表 |
| `uploads_repository.ts` | 上传 | Api only | FDUHole 图片托管服务集成 |
| `stats_repository.ts` | 统计 | Api only | 平台统计/用户聚合统计 |

### 2.4 services/

围绕"用例"编排流程、做输入校验、组合多个仓储。

| 文件 | 服务域 | 主要能力 |
|------|--------|---------|
| `auth_service.ts` | 认证 | 登录（邮箱/用户名自动识别）、注册、刷新 Token、登出 |
| `posts_service.ts` | 帖子 | 两类帖子（share/seeking）输入校验、输入规范化（`normalizePostInput()`）、列表/CRUD/点赞/收藏/状态；并保留结伴状态更新能力 |
| `comments_service.ts` | 评论 | 评论创建校验（长度限制 500）、分页参数清洗、列表/回复/点赞/删除 |
| `users_service.ts` | 用户 | 用户信息获取与更新、头像 URL 校验（Mock/Server 不同策略）、关注/取关 |
| `notifications_service.ts` | 通知 | 通知列表/未读数/标记已读、路由跳转辅助、类型标签/图标映射 |
| `search_service.ts` | 搜索 | 帖子/用户搜索，参数校验与规范化 |
| `admin_service.ts` | 管理 | 帖子审核、用户角色/状态变更、评论管理，分页参数清洗 |
| `upload_service.ts` | 上传 | 单张/批量图片上传（≤9 张，≤5MB），文件类型推断与归一化 |
| `stats_service.ts` | 统计 | 平台统计/用户聚合统计 |
| `config_service.ts` | 配置 | 帖子类型/食堂/菜系/口味配置（带缓存，目前使用本地 fallback） |

### 2.5 context/

React Context 全局状态管理。

- `src/context/auth_context.tsx`
  - 提供全局认证上下文与 `useAuth()` Hook：
    - 状态：`userToken`、`preview`（JWT 解析预览）、`user`（`/auth/me` 完整信息）、`isLoading`、`sessionExpired`
    - 方法：`signIn(token)`、`signOut()`、`refreshUser(token?)`、`clearSessionExpired()`

- `src/context/notifications_context.tsx`
  - 提供未读通知计数与 `useNotifications()` Hook：
    - 状态：`unreadCount`、`loading`
    - 方法：`refreshUnreadCount()`、`decrementUnreadCount()`、`clearUnreadCount()`
    - 行为：已登录时每 60 秒轮询未读数量

- `src/context/theme_context.tsx`
  - 提供主题模式（亮/暗/系统）与自定义主色调，`useTheme()` Hook

- `src/context/waterfall_context.tsx`
  - 提供瀑布流布局参数（最小/最大高度等），供 Explore 页共享

### 2.6 hooks/

自定义 Hook，封装可复用的状态逻辑。

- `src/hooks/use_responsive.ts` — **统一的响应式 Hook**
  - `useResponsive()`：返回 `{ width, height, scale, fontScale, current, isSM, isMD, isLG, isXL }`
  - `useBreakpoint()`：轻量快捷方式，只返回当前断点名称
  - `useMinWidth(bp)` / `useMaxWidth(bp)`：断点判断辅助

- `src/hooks/use_media_query.ts` — 向后兼容的 re-export（已弃用，统一使用 `use_responsive.ts`）

- `src/hooks/use_post_actions.ts`
  - 帖子交互操作 Hook：封装点赞、收藏、关注、分享、复制帖子 ID 等逻辑
  - 从 `post_detail_screen.tsx` 中提取

- `src/hooks/use_post_comments.ts`
  - 帖子评论管理 Hook：封装评论列表加载、分页、排序、点赞、删除、回复面板等全部评论逻辑
  - 从 `post_detail_screen.tsx` 中提取

### 2.7 components/

通用 UI 组件。

- **评论系统** (`comments/`)
  - `comment_composer.tsx`：评论输入框（含 @ 提及、回复目标显示）
  - `comment_item.tsx`：评论/回复卡片（含点赞、展开回复、操作菜单）
  - `bilibili_comment_thread.tsx`：B站风格评论楼中楼面板

- **通知** (`notifications/`)
  - `notification_item.tsx`：单条通知卡片（含关注按钮、已读状态、路由跳转）

- **弹层** (`overlays/`)
  - `bottom_sheet.tsx`：底部弹窗（Modal + Animated）
  - `center_picker.tsx`：居中选择器（用于食堂/口味等选项）

- **Material 3** (`md3/`)
  - `appbar.tsx`：品牌 Appbar 包装（`AppbarHeader`）
  - `masonry.tsx`：响应式瀑布流布局容器

- **帖子卡片**
  - `post_card.tsx`：瀑布流帖子卡片（支持 share/seeking 两种类型，带伪随机图片比例）

- **图片相关**
  - `image_upload_grid.tsx`：图片上传网格（支持多张选择、预览、删除）
  - `image_viewer.tsx`：全屏图片查看器（支持手势缩放）
  - `image_drop_zone.tsx`：Web 端拖拽上传区域

- **其他通用组件**
  - `user_avatar.tsx`：用户头像（可点击跳转用户主页）
  - `theme_color_picker.tsx`：主题色选择器
  - `haptic_tab.tsx`：触觉反馈 Tab
  - `parallax_scroll_view.tsx`：视差滚动头部
  - `themed_text.tsx` / `themed_view.tsx`：主题化文本/视图
  - `external_link.tsx`：外部链接

### 2.8 screens/

页面级组件，负责绑定 Service/Context，组织 UI 组件与业务交互。

| 文件 | 页面 | 说明 |
|------|------|------|
| `explore_screen.tsx` | 探索页 | 瀑布流展示，响应式列数/间距，搜索栏（大屏显示） |
| `post_detail_screen.tsx` | 帖子详情 | 桌面/移动双布局，评论系统，图片轮播，通过 `usePostActions` 和 `usePostComments` Hook 管理逻辑 |
| `post_screen.tsx` | 发帖/编辑 | 两类帖子表单（share/seeking），图片上传，响应式布局 |
| `search_screen.tsx` | 搜索页 | 帖子/用户搜索，历史记录，瀑布流结果 |
| `login_screen.tsx` | 登录页 | 邮箱/用户名登录，Session 过期提示 |
| `register_screen.tsx` | 注册页 | 表单校验 + 注册 |
| `myself_screen.tsx` | 个人中心 | 用户信息、帖子/收藏列表、管理入口 |
| `settings_screen.tsx` | 设置页 | 个人资料编辑、主题切换、主题色选择 |
| `my_posts_screen.tsx` | 我的帖子 | 用户帖子列表 |
| `my_followers_screen.tsx` | 关注/粉丝 | 关注与粉丝列表 |
| `user_profile_screen.tsx` | 用户主页 | 他人公开资料与帖子 |
| `user_followers_screen.tsx` | 用户关注/粉丝 | 他人关注与粉丝列表 |
| `notifications_screen.tsx` | 通知页 | 分类通知列表（全部/评论/点赞/关注/系统），全部已读 |
| `admin_screen.tsx` | 管理后台 | 管理仪表盘（三列响应式布局） |
| `admin_posts_screen.tsx` | 帖子管理 | 待审核帖子列表与审核操作 |
| `admin_users_screen.tsx` | 用户管理 | 用户列表与角色/状态管理 |
| `admin_comments_screen.tsx` | 评论管理 | 评论列表与删除操作 |

### 2.9 app/

Expo Router 路由入口。路由文件通常只做路由绑定与 Screen 引入，保持"薄"。

```
app/
├── _layout.tsx                 # 根布局：全局 Provider（Theme、Paper、Auth、Notifications、Waterfall）+ Web autofill 样式注入
├── index.tsx                   # 首页路由：根据登录态重定向
├── (auth)/
│   ├── _layout.tsx             # 认证分组布局（已登录→重定向探索页）
│   ├── login.tsx
│   └── register.tsx
├── (tabs)/
│   ├── _layout.tsx             # Tab 布局 + 响应式侧边栏（md 断点切换，搜索/管理等子路由按路径隐藏 TabBar）
│   ├── explore.tsx             # 探索
│   ├── post.tsx                # 发帖
│   ├── search.tsx              # 搜索
│   └── myself/
│       ├── _layout.tsx         # "我的" Stack 布局
│       ├── index.tsx           # 个人中心
│       ├── settings.tsx        # 设置
│       ├── posts.tsx           # 我的帖子
│       ├── followers.tsx       # 我的粉丝
│       ├── following.tsx       # 我的关注
│       └── admin/
│           ├── _layout.tsx     # 管理后台 Stack 布局
│           ├── index.tsx       # 管理仪表盘
│           ├── posts.tsx       # 帖子管理
│           ├── users.tsx       # 用户管理
│           └── comments.tsx    # 评论管理
├── notifications.tsx           # 通知页
├── search.tsx                  # 独立搜索路由
├── post/
│   ├── _layout.tsx
│   ├── [postId].tsx            # 帖子详情（动态路由）
│   └── edit/
│       └── [postId].tsx        # 帖子编辑（动态路由）
└── user/
    ├── _layout.tsx
    └── [userId]/
        ├── _layout.tsx
        ├── index.tsx           # 用户主页（动态路由）
        ├── followers.tsx       # 用户粉丝
        └── following.tsx       # 用户关注
```

### 2.10 models/

领域模型定义，纯类型文件。

- `User.ts`：用户模型（`User`、`UserStats`、`Gender`）
- `Post.ts`：帖子模型与联合类型（`Post = SharePost | SeekingPost`）、创建输入（`PostCreateInput`）、结伴状态请求类型等
- `Comment.ts`：评论模型（`Comment`、`CommentReply`、`CommentEntity`、`CommentsListResponse`、`CreateCommentInput`）
- `Stats.ts`：平台统计（`PlatformStats`）、用户聚合统计（`UserAggregateStats`）

### 2.11 utils/

工具函数聚合。

- `src/utils/index.ts`：Web 平台样式工具（当前包含 `WEB_NO_OUTLINE`）
- `src/utils/time_format.ts`：**统一的时间格式化工具**
  - `formatRelativeTime(dateString)`：相对时间（"刚刚"/"5分钟前"/"昨天"/"3月16日"）
  - `formatDate(dateString, style)`：绝对日期（compact `03-16` / short `3/16` / full `2026/3/16`）
  - `formatRelativeOrDate(dateString)`：混合格式（7天内相对，超过显示 `MM-DD`）
  - `formatCurrentDate(style)`：当前日期格式化
- `src/utils/alert.ts`：跨平台 `showAlert()` 辅助（Web 用 `window.alert`，Native 用 `Alert.alert`）
- `src/utils/post_converters.ts`：帖子数据转换（`mapUserPostListItemToPost`），用于统一 API 返回不同格式的帖子数据

---

## 3. 分层架构详解（职责、依赖与边界）

### 3.1 常量与配置层（Constants）

- **职责**：集中"可变点"（环境变量、常量、运行时开关、主题 Token）。
- **依赖**：仅被下游依赖，本层不依赖业务代码。
- **边界**：不包含 IO/网络逻辑，不持有可变状态。
- **注意**：原 `src/config/index.ts` 已合并至 `src/constants/app.ts`，不再存在独立的 config 层。

### 3.2 基础设施层（Infra）

- **职责**：提供跨域基础能力，统一错误、网络、认证与主题色生成。
- **组成**：
  - 错误：`AppError` 统一错误类型与归一化工具
  - HTTP：`client.ts`（未鉴权）、`http_auth.ts`（带 Authorization + 自动刷新）
  - 响应：`response.ts` 提供 `unwrapApiResponse<T>()`
  - 认证：`auth_storage.ts` 管理 token、`jwt.ts` 解析 payload、`roles.ts` 角色判定
  - 主题：`color_generator.ts` 基于 Material Color Utilities 生成动态调色板
- **边界**：不涉及业务拼装，不直接依赖 UI。

### 3.3 数据访问层（Repositories）

- **职责**：以"资源"为单位，提供稳定的 CRUD 接口；屏蔽数据源差异。
- **模式**：定义 TypeScript 接口 → 提供 Mock + Api 两种实现 → 依据 `USE_MOCK` 自动导出
- **约定**：读操作走 `http`（未鉴权），写操作走 `httpAuth`（鉴权），统一用 `unwrapApiResponse` 解包
- **边界**：不做输入校验/格式化；不直接操作 UI/导航

### 3.4 领域服务层（Services）

- **职责**：围绕"用例"编排流程、做输入校验、组合多个仓储
- **约定**：
  - 所有用户输入在 Service 层统一 trim/校验/规范化
  - 分页参数统一清洗（`page ≥ 1`、`limit ∈ [1, 50]`）
  - 错误统一抛出 `AppError`
- **边界**：不关心 UI 形态/状态管理；不直接做持久化

### 3.5 表现层（Presentation）

- **职责**：渲染 UI、处理交互，将事件委托给 Services/Context
- **构成**：Context → Hooks → Components → Screens → Routes
- **依赖**：Services（业务调用）、Constants（主题/断点/标签）、少量 Infra（类型/工具）
- **边界**：不直接发 HTTP、不直接访问存储、不编排复杂业务

---

## 4. HTTP 与错误处理（统一约定）

- **响应结构**：后端返回 `{ code: number; message: string; data: T }`
- **正常结果**：`code === 200`（可按后端调整），使用 `unwrapApiResponse` 直接获取 `data`
- **异常结果**：`code !== 200` 或网络错误/解析错误，均转换为 `AppError`
- **日志约定**：所有 `console.log`/`console.warn`/`console.error` 均使用 `if (__DEV__)` 守卫，防止生产环境泄露调试信息

---

## 5. 认证与权限（Auth + Roles）

### Token 管理

- **Access Token**：存储于 `AuthStorage`（`STORAGE_KEYS.AUTH_TOKEN`），有效期 1 小时
- **Refresh Token**：存储于 `AuthStorage`（`STORAGE_KEYS.REFRESH_TOKEN`），有效期 30 天
- 鉴权客户端自动注入 `Authorization` 头

### 登录后体验优化

1. **立即显示**：从 JWT Payload 解析 `nickname/name` 与 `avatarUrl/avatar`，立刻用于 UI 预览
2. **完整信息**：后台调用 `/auth/me` 获取完整 `User` 并回填，覆盖预览信息
3. **字段兼容**：昵称兼容 `nickname`/`name`，头像兼容 `avatarUrl`/`avatar`

### 双 Token 刷新机制

| 模块 | 功能 | 文件 |
|------|------|------|
| **存储层** | `getRefreshToken()` / `setRefreshToken()` / `clearRefreshToken()` | `auth_storage.ts` |
| **API 层** | `REFRESH` 端点、`refresh(refreshToken)` 调用 | `constants/app.ts`、`auth_repository.ts` |
| **服务层** | 登录/注册时保存 refresh_token、`refresh()` 刷新、`logout()` 清除双 token | `auth_service.ts` |
| **HTTP 层** | `isTokenExpiredError()` 判断 401、`refreshAccessToken()` 自动刷新、并发刷新锁 | `http_auth.ts` |
| **状态层** | `sessionExpired` 状态标记、`clearSessionExpired()` 清除 | `auth_context.tsx` |
| **UI 层** | 监听 `sessionExpired`、Banner 显示"登录已过期" | `login_screen.tsx` |

```
用户操作 → API 请求
           ↓
      access_token 过期 (401)
           ↓
      自动用 refresh_token 刷新
           ↓
    ┌──────┴──────┐
    ↓             ↓
 刷新成功      刷新失败
    ↓             ↓
 重试请求    清除所有 token
 继续操作    设置 sessionExpired
              ↓
           跳转登录页
              ↓
         显示 Banner 提示
        "登录已过期，请重新登录"
```

### 角色与权限

- 角色层级：`user` < `admin` < `super_admin`
- 工具函数：`hasRoleAtLeast(role, minRole)`、`isAdmin(role)`、`isSuperAdmin(role)`
- 管理后台入口仅对 `admin` 及以上角色可见

---

## 6. Mock / Server 切换（操作指南）

在项目根（`danshi/`）创建 `.env`（参考 `.env.example`）：

```env
EXPO_PUBLIC_USE_MOCK=false
EXPO_PUBLIC_API_URL=https://your-api-server.com/api/v1
EXPO_PUBLIC_REQUEST_TIMEOUT_MS=10000
```

- `USE_MOCK=true`：使用内存 Mock 数据，无需后端
- `USE_MOCK=false`（默认）：连接真实后端 API

---

## 7. 主题与设计系统（Theme + DS）

### 主题架构

- **Provider 层**：`ThemeModeProvider`（`context/theme_context.tsx`）管理模式（亮/暗/系统）与自定义主色调
- **主题构建**：`getMD3Theme(mode, accentColor?)`（`constants/md3_theme.ts`）
  - 无自定义色：使用预设品牌色（橙色系 `#F97316`）
  - 有自定义色：通过 Material Color Utilities（`color_generator.ts`）动态生成完整调色板
- **主题注入**：`PaperProvider`（`app/_layout.tsx`）提供全局 MD3 主题
- **主题消费**：页面/组件优先使用 `useExtendedTheme()`；上下文层通过 `useTheme()` 暴露扩展颜色与常用语义字段

### 语义颜色

| 语义 | 亮色 | 暗色 | 用途 |
|------|------|------|------|
| `recommend` | 绿色系 `#059669` | `#34D399` | 推荐类帖子 |
| `warning` | 红色系 `#DC2626` | `#F87171` | 避雷类帖子 |
| `seeking` | 紫色系 `#7C3AED` | `#A78BFA` | 求助类帖子 |

### 组件规范

- 优先使用 `react-native-paper` MD3 组件
- 不在组件内硬编码颜色，统一走主题 Token 或 `useExtendedTheme()`
- Web 平台特殊样式统一收敛到工具常量或根级样式注入；当前根布局额外处理浏览器 autofill 样式覆盖

---

## 8. 响应式系统（Responsive）

### 断点定义

| 断点 | 最小宽度 | 典型场景 |
|------|---------|---------|
| `base` | 0 | 手机竖屏 |
| `sm` | 640px | 大手机/小平板 |
| `md` | 768px | 平板/侧边栏切换点 |
| `lg` | 1024px | 桌面/搜索栏显示点 |
| `xl` | 1280px | 大屏桌面 |

### 使用方式

```typescript
// 方式1：完整响应式信息
const { width, isMD, isLG, current } = useResponsive();

// 方式2：轻量断点名称
const bp = useBreakpoint();

// 方式3：按断点选择值
const maxWidth = pickByBreakpoint(bp, { base: '100%', sm: 540, md: 580, lg: 620 });
```

### 屏幕实践

- **Tab 布局**：`md` 断点切换底部 Tab 与侧边栏
- **帖子详情**：`md` 断点切换单列/桌面双栏布局
- **探索页**：瀑布流列数随断点变化，`lg` 断点显示内联搜索栏
- **管理后台**：`md` 断点切换双列/三列网格

### 重要约定

- **优先复用断点常量**，避免散落硬编码断点数字；当前代码中仍存在少量 `useWindowDimensions()` 直接读取宽度的页面
- 断点判断优先使用 `useResponsive()` / `useBreakpoint()` / `pickByBreakpoint()`，需要精确尺寸时可直接配合 `useWindowDimensions()`

---

## 9. 页面与路由（Screens + expo-router）

- 路由入口统一在 `src/app/`，每个路由文件导向相应 `src/screens/*`
- 屏幕职责：
  - 绑定服务/上下文，处理用户交互
  - 使用通用 UI 组件，实现一致的主题与响应式表现
  - 复杂逻辑提取为自定义 Hook（如 `usePostActions`、`usePostComments`）
- 路由跳转统一使用 `Href` 类型（从 `expo-router` 导入），避免 `as any`

---

## 10. 数据模型与存储（Models + Storage）

- `models/` 目录存放纯类型定义，便于静态类型检查
- AsyncStorage 键统一在 `STORAGE_KEYS` 中管理
- 帖子采用联合类型（`Post = SharePost | SeekingPost`），通过 `post_type` 字段区分

### API 路径约定

- 所有 API 路径定义在 `API_ENDPOINTS`（`constants/app.ts`），仅含路径部分
- Base URL（含 `/api/v1` 前缀）由 `API_BASE_URL` 提供

---

## 11. 开发约定与风格指南

### 导入规范
- 优先使用别名 `@/src/...`，减少相对路径层级

### 命名规范
- 文件：`snake_case.tsx`（如 `post_detail_screen.tsx`）
- 组件：`PascalCase`（如 `PostCard`）
- Hook：`useCamelCase`（如 `usePostActions`）
- 常量：`SCREAMING_SNAKE_CASE`（如 `API_ENDPOINTS`）
- 类型：`PascalCase`（如 `PostCreateInput`）

### 类型安全
- **禁止滥用 `as any`**，使用正确的类型断言或辅助工具：
  - 路由跳转：`as Href`（从 `expo-router` 导入 `type Href`）
  - 主题颜色：使用 `useExtendedTheme()` 而非 `usePaperTheme()` + `as any`
  - Ionicons 图标：`as keyof typeof Ionicons.glyphMap`
  - Web 样式：优先使用平台样式工具或根级样式注入
  - Service 层：通过类型缩窄处理联合类型

### 日志约定
- 所有 `console.log`/`warn`/`error` 必须使用 `if (__DEV__)` 守卫
- 生产环境不输出任何调试信息

### 组件职责
- 避免在 UI 组件中写具体业务逻辑，业务均在 Service/Context
- 屏幕组件保持"薄"，复杂逻辑提取为自定义 Hook

### 可测性
- 关键 Service 方法建议配最小单元测试
- UI 组件在交互复杂时配合测试库编写交互测试

---

## 12. 目录与文件清单（逐项说明）

> 以 `danshi/` 目录为根，逐一说明文件用途。

### 根目录

| 文件 | 说明 |
|------|------|
| `app.json` | Expo 工程配置（名称、图标、平台等） |
| `eslint.config.js` | ESLint 配置 |
| `expo-env.d.ts` | Expo 相关类型声明扩展 |
| `package.json` | 依赖与脚本 |
| `tsconfig.json` | TypeScript 编译选项（含路径别名 `@/`） |
| `scripts/reset-project.js` | 项目重置/维护脚本 |
| `assets/images/*` | 图标与图片资源 |

### src/constants/

| 文件 | 说明 |
|------|------|
| `app.ts` | 运行时配置、存储键、API 端点、角色、正则 |
| `breakpoints.ts` | 断点定义与选择器 |
| `layout.ts` | 布局常量（Spacing/Fonts/TypeScale） |
| `md3_theme.ts` | MD3 主题构建、语义颜色、`useExtendedTheme()` Hook |
| `post_labels.ts` | 帖子类型/分享类型中文标签、`LoaderState` 类型 |
| `selects.ts` | 下拉选项（家乡、食堂） |
| `theme.ts` | 默认主题色设计 |

### src/lib/

| 文件 | 说明 |
|------|------|
| `errors/app_error.ts` | 统一错误类型 `AppError` |
| `http/client.ts` | 未鉴权 HTTP 客户端 `http` |
| `http/http_auth.ts` | 鉴权 HTTP 客户端 `httpAuth`（含自动刷新） |
| `http/response.ts` | API 响应类型与解包器 |
| `security/url.ts` | URL 安全校验与远程资源地址清洗 |
| `auth/auth_storage.ts` | Token 持久化 |
| `auth/jwt.ts` | JWT Payload 解码 |
| `auth/roles.ts` | 角色判定工具 |
| `theme/color_generator.ts` | Material Color Utilities 动态调色板生成器 |

### src/repositories/

| 文件 | 说明 |
|------|------|
| `auth_repository.ts` | 认证仓储（Mock + Api） |
| `posts_repository.ts` | 帖子仓储（Mock + Api） |
| `comments_repository.ts` | 评论仓储（Mock + Api） |
| `users_repository.ts` | 用户仓储（Mock + Api） |
| `notifications_repository.ts` | 通知仓储（Api） |
| `search_repository.ts` | 搜索仓储（Api） |
| `admin_repository.ts` | 管理仓储（Api） |
| `uploads_repository.ts` | FDUHole 图片上传仓储（Api） |
| `stats_repository.ts` | 统计仓储（Api） |

### src/services/

| 文件 | 说明 |
|------|------|
| `auth_service.ts` | 认证服务 |
| `posts_service.ts` | 帖子服务（含 `normalizePostInput()`、列表 fallback 与结伴状态更新） |
| `comments_service.ts` | 评论服务 |
| `users_service.ts` | 用户服务 |
| `notifications_service.ts` | 通知服务 |
| `search_service.ts` | 搜索服务 |
| `admin_service.ts` | 管理服务 |
| `upload_service.ts` | 图片上传服务 |
| `stats_service.ts` | 统计服务 |
| `config_service.ts` | 配置服务（帖子类型/食堂/菜系/口味） |

### src/context/

| 文件 | 说明 |
|------|------|
| `auth_context.tsx` | 认证上下文（`useAuth()`） |
| `notifications_context.tsx` | 通知上下文（`useNotifications()`） |
| `theme_context.tsx` | 主题上下文（`useTheme()`） |
| `waterfall_context.tsx` | 瀑布流设置上下文 |

### src/hooks/

| 文件 | 说明 |
|------|------|
| `use_responsive.ts` | 统一响应式 Hook（`useResponsive`/`useBreakpoint`/`useMinWidth`/`useMaxWidth`） |
| `use_media_query.ts` | 向后兼容 re-export（已弃用） |
| `use_post_actions.ts` | 帖子交互操作 Hook |
| `use_post_comments.ts` | 帖子评论管理 Hook |

### src/components/

| 目录/文件 | 说明 |
|-----------|------|
| `comments/comment_composer.tsx` | 评论输入框 |
| `comments/comment_item.tsx` | 评论卡片 |
| `comments/bilibili_comment_thread.tsx` | 楼中楼面板 |
| `notifications/notification_item.tsx` | 通知卡片 |
| `overlays/bottom_sheet.tsx` | 底部弹窗 |
| `overlays/center_picker.tsx` | 居中选择器 |
| `md3/appbar.tsx` | 品牌 Appbar |
| `md3/masonry.tsx` | 瀑布流容器 |
| `post_card.tsx` | 帖子卡片 |
| `image_upload_grid.tsx` | 图片上传网格 |
| `image_viewer.tsx` | 图片查看器 |
| `image_drop_zone.tsx` | Web 拖拽上传区 |
| `user_avatar.tsx` | 用户头像 |
| `theme_color_picker.tsx` | 主题色选择器 |
| `haptic_tab.tsx` | 触觉反馈 Tab |
| `parallax_scroll_view.tsx` | 视差滚动 |
| `themed_text.tsx` / `themed_view.tsx` | 主题化基础组件 |
| `external_link.tsx` | 外部链接 |

### src/utils/

| 文件 | 说明 |
|------|------|
| `index.ts` | 平台样式工具（当前包含 `WEB_NO_OUTLINE`） |
| `time_format.ts` | 统一时间格式化（`formatRelativeTime`/`formatDate`/`formatRelativeOrDate`/`formatCurrentDate`） |
| `alert.ts` | 跨平台 `showAlert()` |
| `post_converters.ts` | 帖子数据格式转换 |

### src/models/

| 文件 | 说明 |
|------|------|
| `User.ts` | 用户模型（`User`/`UserStats`/`Gender`） |
| `Post.ts` | 帖子模型（`Post`/`SharePost`/`SeekingPost`/`PostCreateInput`） |
| `Comment.ts` | 评论模型（`Comment`/`CommentReply`/`CommentEntity`/`CreateCommentInput`） |
| `Stats.ts` | 统计模型（`PlatformStats`/`UserAggregateStats`） |

---

(完)
