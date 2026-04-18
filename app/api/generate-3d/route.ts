import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { image, keywords, vision } = await request.json();

    // 这里需要集成实际的图像转3D模型API
    // 可选方案：
    // 1. Meshy AI (https://www.meshy.ai/)
    // 2. Luma AI (https://lumalabs.ai/)
    // 3. Tripo AI (https://www.tripo3d.ai/)

    // 示例：模拟API调用
    // const response = await fetch('https://api.meshy.ai/v1/image-to-3d', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${process.env.MESHY_API_KEY}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({ image_url: image }),
    // });

    // 暂时返回模拟数据
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 所有模型共用背景的缩放系数，GLB 原始尺寸比例自动保留
    // fixed: 固定物体不可拖拽
    // bounds: 归一化坐标 [minX, minY, maxX, maxY] 限制拖拽范围
    // scale: 可选微调，默认 1，不需要预定义模型大小
    //
    // 参照 layout-result.json 的布局数据
    return NextResponse.json({
      bgUrl: '/bg.glb',
      things: [
        { id: 'laptop-1',    url: '/laptop.glb',    position: [0.5, 0.7, 0],      rotation: [0, 0, 0],   scale: 1 },
        { id: 'notebook-1',  url: '/notebook.glb',  position: [0.2692, 0.6417, 0], rotation: [0, 0, 0],   scale: 1 },
        { id: 'penholder-1', url: '/penholder.glb', position: [0.7417, 0.8, 0],    rotation: [0, 0, 270], scale: 1 },
        { id: 'cup-1',       url: '/cup.glb',       position: [0.14, 0.77, 0],     rotation: [0, 0, 0],   scale: 1 },
      ],
      success: true,
    });
  } catch (error) {
    console.error('生成3D模型错误:', error);
    return NextResponse.json(
      { error: '生成3D模型失败' },
      { status: 500 }
    );
  }
}
