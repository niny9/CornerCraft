# 照片转3D模型项目

这是一个使用 Next.js 构建的照片转3D模型应用。

## 功能特性

- 📷 支持相机拍照
- 📁 支持图片上传
- 🎨 实时3D模型预览
- 🔄 响应式设计

## 技术栈

- Next.js 16
- React 19
- TypeScript
- Three.js + React Three Fiber
- Tailwind CSS

## 开始使用

1. 安装依赖：
```bash
npm install
```

2. 运行开发服务器：
```bash
npm run dev
```

3. 打开浏览器访问 [http://localhost:3000](http://localhost:3000)

## 集成3D模型生成API

目前项目使用模拟数据。要集成真实的图像转3D模型服务，可以选择以下方案：

### 1. Meshy AI
- 网站: https://www.meshy.ai/
- 特点: 高质量3D模型生成

### 2. Luma AI
- 网站: https://lumalabs.ai/
- 特点: 支持视频和图片转3D

### 3. Tripo AI
- 网站: https://www.tripo3d.ai/
- 特点: 快速生成，支持多种格式

配置步骤：
1. 注册并获取API密钥
2. 在项目根目录创建 `.env.local` 文件
3. 添加API密钥：
```
MESHY_API_KEY=your_api_key_here
```
4. 修改 `app/api/generate-3d/route.ts` 中的API调用代码

## 项目结构

```
photo-to-3d/
├── app/
│   ├── api/
│   │   └── generate-3d/
│   │       └── route.ts          # 3D模型生成API
│   └── page.tsx                  # 主页面
├── components/
│   ├── CameraCapture.tsx         # 相机拍照组件
│   └── ModelViewer.tsx           # 3D模型查看器
└── public/
    └── models/                   # 3D模型文件
```

## 部署

可以部署到 Vercel：

```bash
npm run build
```

或使用 Vercel CLI：

```bash
vercel
```
