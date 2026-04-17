# CornerCraft

CornerCraft 是一个小空间改造应用。当前仓库已经补上了后端基础能力：前端提交角落照片和偏好信息后，会通过 Next.js Route Handler 生成结构化改造方案，并把结果写入 Supabase，方便后续在 Render 上部署。

## 当前能力

- 上传图片或使用相机拍照
- 生成并展示空间理解、改造策略、推荐物品和预算
- 用 `Supabase` 持久化项目记录和生成结果
- 读取历史项目列表与详情
- 保留现有 Three.js 3D 预览能力

## 技术栈

- Next.js 16
- React 19
- TypeScript
- Three.js + React Three Fiber
- Supabase
- Tailwind CSS 4

## 本地启动

1. 安装依赖

```bash
npm install
```

2. 配置环境变量

把 `.env.example` 复制为 `.env.local`，并填入：

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

3. 在 Supabase SQL Editor 执行 [supabase/schema.sql](/Users/grace/Desktop/corner/supabase/schema.sql)

4. 启动开发环境

```bash
npm run dev
```

## API

- `POST /api/corners/generate`
  输入图片、空间类型、风格标签、兴趣标签、预算档位，返回结构化方案并写库。
- `GET /api/corners`
  读取最近项目列表。
- `GET /api/corners/:id`
  读取单个项目详情。
- `GET /api/health`
  Render 健康检查。
- `POST /api/generate-3d`
  兼容旧前端调用，内部复用新的生成逻辑。

## 数据库

当前使用一张主表 `corner_projects`：

- 输入字段：图片、空间类型、风格标签、兴趣标签、预算
- 输出字段：`scene_understanding`、`plan_output`
- 展示字段：`background_url`、`viewer_models`
- 状态字段：`status`、`error_message`

## Render 部署

仓库根目录已提供 [render.yaml](/Users/grace/Desktop/corner/render.yaml)。

Render 上需要配置的环境变量：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

构建和启动命令：

- Build: `npm install && npm run build`
- Start: `npm run start`
