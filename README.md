# PivotOS UI（pivotos-ui）

> 枢磐 PivotOS「一码三端」企业管理平台 —— PC 管理端（pnpm workspace Monorepo）
>
> 📖 在线文档：[pivotos-doc.293242.com](https://pivotos-doc.293242.com) ｜ 🖥️ 在线演示：[pivotos-pc.293242.com](https://pivotos-pc.293242.com)（账号 `admin / admin123`）

## 技术栈

Vue 3 + TypeScript 5.8 + Vite 7 + Element Plus + UnoCSS + Pinia + vue-router 4 + vue-i18n + ECharts + wangeditor

## Monorepo 结构

按「类型定义 → 核心能力 → 通用 UI → 业务组件 → 应用」五层组织：

```
pivotos-ui
├── packages/
│   ├── types/        # @pivotos/types       与后端 DTO 一一对应的全量 TS 类型声明
│   ├── core/         # @pivotos/core        Axios 封装 / 权限校验 / 指令 / hooks（字典/分页/下载），无框架依赖
│   ├── ui/           # @pivotos/ui          Element Plus 二次封装：YTable / YForm / YDialog / YSearchForm + 主题系统
│   └── components/   # @pivotos/components  业务组件：字典回显 / 部门树 / 用户选择 / 图标选择 / 文件上传
└── apps/admin/       # @pivotos/admin       管理端应用（布局 / 动态路由 / Pinia / 系统管理 / 消息 / AI / 工作流…）
```

**关键约定**：

- 业务页面只允许引用 `@pivotos/ui` 导出组件（`<YTable>` / `<YForm>`），禁止直接 import Element Plus
- 所有 API 调用集中于 `api/{域}/*.ts`，禁止组件内裸调 axios
- 单文件组件 ≤ 400 行；按钮级权限 `v-hasPermi`，角色判断 `v-hasRole`
- 请求统一 `/api` 前缀：开发经 Vite 代理、生产经 Nginx 反代剥离前缀，三环境零 CORS

## 功能模块

系统管理（用户/角色/菜单/部门/岗位/字典/参数/公告/日志/在线用户）· 消息中心 · 文件管理 · 工作流（流程定义/发起/待办/已办）· AI 对话（SSE 流式 + RAG 引用联动）· AI Coding · AI 知识库（解析预览/分块/检索评测）· AI 配置（供应商/多 Key）· 代码生成器 · 监控（服务/缓存/运营看板）· 认证与个人中心

## 开发调试

环境要求：Node ≥ 20、pnpm 9.x

```bash
git clone https://github.com/pivotos-inc/pivotos-ui.git
cd pivotos-ui
pnpm install

cp apps/admin/.env.example apps/admin/.env.development   # 按需修改后端地址（默认 http://localhost:8080）

pnpm dev            # 启动管理端 http://localhost:5173（/api 代理到后端）
pnpm typecheck      # 类型门禁（全 5 包）
pnpm build          # 构建门禁（产物 apps/admin/dist/）
```

## 生产部署

`pnpm build` 后将 `apps/admin/dist/` 部署至 Nginx（样例见 framework 仓 `deploy/nginx-pivotos.conf`）：静态文件 + `location /api/` 反代后端并剥离 `/api` 前缀。详见在线文档《部署指南》。

## 相关仓库

| 仓库 | 说明 |
| --- | --- |
| [pivotos-framework](https://github.com/pivotos-inc/pivotos-framework) | 后端（Spring Boot 4.x + JDK 25，35 模块） |
| [pivotos-app](https://github.com/pivotos-inc/pivotos-app) | 移动端（uni-app 一码三端） |
| [pivotos-docs](https://github.com/pivotos-inc/pivotos-docs) | 项目文档库 |

## 维护约定

> 新增页面 / 业务模块或 packages 包时，须同步更新本 README 的「Monorepo 结构」「功能模块」两节及在线文档对应章节。
