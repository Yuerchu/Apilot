# Apilot

现代化的 OpenAPI 文档查看与 API 测试工具。基于 React、TypeScript、Shadcn/ui 和 Tailwind CSS 构建。

**在线体验**：[openapi.yxqi.cn](https://openapi.yxqi.cn) | [English README](README.md)

## 功能特性

### API 文档与测试

- **Schema 驱动表单** — 根据 OpenAPI Schema 类型自动渲染输入控件（文本、数字、布尔、枚举、日期选择器、文件上传、UUID 生成器）
- **在线 API 测试** — 在浏览器中直接发送请求，支持参数校验、认证头和响应展示
- **JSON 编辑器** — CodeMirror 6 语法高亮，与 Schema 表单双向同步
- **结构化 Schema 展示** — 三列表格视图（字段 / 类型 / 描述），支持嵌套对象展开
- **Curl 生成** — 自动生成 curl 命令，一键复制
- **Token 提取** — 检测登录响应中的 token 字段，一键设为 Bearer 认证
- **请求历史** — 每个端点的请求记录，持久化存储在 IndexedDB

### 数据模型

- **模型浏览器** — 浏览所有 Schema 定义，展示字段详情和约束条件
- **模型关系图** — 交互式关系图谱，支持聚焦/深度控制，导出 SVG/PNG/Mermaid
- **模型 ↔ 端点关联** — 查看端点引用的模型，以及引用某个模型的所有端点

### Schema 查看器

- **OpenAPI 和外部 Schema** — 查看已加载 spec 中的 Schema，或上传独立的 JSON/YAML 文件
- **字段详情检查** — 约束条件、默认值、枚举选项、文件上传规则、跨字段规则
- **分类与类型过滤** — 按分类标签和类型筛选 Schema

### 环境管理

- **环境配置** — 创建多个环境（本地/开发/测试/预发布/生产），各自独立的 Base URL 和认证配置
- **从 Spec 自动填充** — 环境列表自动从 OpenAPI `servers[]` 字段生成
- **独立认证** — 每个环境存储自己的认证类型、Token 和凭据
- **快速切换** — 侧边栏下拉选择器，一键切换环境
- **跨环境 API 状态检测** — 后台拉取各环境的 spec，自动检测端点存在性，推断生命周期状态（已上线 / 测试中 / 开发中 / 本地开发 / 他人开发）
- **状态筛选** — 按跨环境状态筛选端点列表

### 诊断与差异对比

- **API 诊断** — 检测未解析的 $ref、重复 operationId、空 Schema、缺失描述等问题
- **Spec 差异对比** — 两个 OpenAPI 规范并排对比，标注破坏性变更

### 收藏

- **星标端点** — 点击星标收藏常用端点
- **收藏页面** — 侧边栏独立页面，集中浏览所有已收藏端点

### 通用

- **多种认证方式** — Bearer、Basic、API Key、OAuth2 密码模式
- **兼容 Swagger 2.0 / OpenAPI 3.0 / 3.1** — 自动转换 Swagger 2.0 规范
- **深色主题** — OKLCH 色彩系统，支持跟随系统/浅色/深色模式
- **多语言** — 英语、简体中文、繁体中文、港式中文、日语、韩语
- **分享链接** — 生成包含 Spec 地址、Base URL 和当前位置的分享链接
- **环境变量** — 定义 `{{变量}}`，在参数和请求体中使用
- **命令面板** — `Cmd+K` / `Ctrl+K` 快速搜索端点、模型和 Schema
- **渐进渲染** — 500+ 端点不卡顿
- **单文件输出** — 构建为单个 `dist/index.html`，部署简单
- **FastAPI 集成** — Python 包，一行代码替换 FastAPI 内置 Swagger UI

## 快速开始

```bash
pnpm install
pnpm dev
```

打开 [http://localhost:5173](http://localhost:5173)，粘贴 OpenAPI Spec URL，点击加载。

## URL 参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `openapi_url` | 自动加载 Spec | `?openapi_url=https://api.example.com/openapi.json` |
| `base_url` | 覆盖服务器地址 | `&base_url=https://api.example.com` |
| `auth_type` | 设置认证类型（`bearer`、`basic`、`apikey`） | `&auth_type=bearer` |
| `auth_token` | 设置认证 Token | `&auth_token=xxx` |
| `title` | 覆盖页面标题 | `&title=My%20API` |

## 构建

```bash
pnpm build        # 生产构建 -> dist/index.html（单文件）
pnpm test         # 运行测试
pnpm lint         # ESLint 检查
pnpm typecheck    # TypeScript 类型检查
```

## FastAPI 集成

参见 [openapi-advance-python](https://github.com/Yuerchu/openapi-advance-python)，一行代码替换 FastAPI 内置的 Swagger UI：

```python
from fastapi import FastAPI
from openapi_advance import setup_docs

app = FastAPI(docs_url=None)
setup_docs(app)
```

## 技术栈

- **React 19** + **TypeScript 6** + **Vite 8**
- **Shadcn/ui**（Radix Nova 风格）— 20+ 组件
- **Tailwind CSS v4** + OKLCH 色彩系统
- **CodeMirror 6** — JSON 编辑器
- **TanStack Virtual** — 大列表虚拟滚动
- **Motion**（Framer Motion）+ **animate-ui** — 动画
- **idb** — IndexedDB 封装，持久化存储
- **react-i18next** — 国际化（6 种语言）
- **Sonner** — Toast 通知
- **marked** — Markdown 渲染
- **vite-plugin-singlefile** — 单 HTML 文件输出

## 项目结构

```
src/
├── components/
│   ├── ui/              # Shadcn 组件（20+）
│   ├── animate-ui/      # 动画组件（Motion 驱动）
│   ├── layout/          # AppSidebar, Header, EnvironmentSwitcher, ViewToolbar, SelectionFab
│   ├── endpoints/       # RouteCard, EndpointsView, FavoritesView, TryTab, DocTab, HistoryTab
│   ├── models/          # ModelsView, ModelCard, ModelGraphView
│   ├── schema/          # SchemaViewerView, SchemaTree, SchemaForm, SchemaInput
│   ├── settings/        # SettingsDialog, ConnectionSettings, AuthSettings, StorageSettings
│   ├── tools/           # ProjectToolsView（诊断、差异对比）
│   ├── search/          # CommandPalette（命令面板）
│   ├── share/           # ShareDialog（分享对话框）
│   └── editor/          # JsonEditor, CodeViewer
├── hooks/               # useOpenAPI, useAuth, useRequest, useSettings, useEnvironments,
│                        #   useFavorites, useMultiEnvStatus
├── contexts/            # OpenAPIContext, AuthContext
├── lib/
│   └── openapi/         # 解析器、$ref 解析、Schema 处理、路由提取、差异对比
└── locales/             # en, zh_CN, zh_TW, zh_HK, ja, ko
```

## 许可证

MIT
