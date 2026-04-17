import { NextRequest, NextResponse } from 'next/server';
import { generateCornerPlan, validateGenerateInput } from '@/lib/corner/service';

export async function POST(request: NextRequest) {
  try {
    const payload = validateGenerateInput(await request.json());
    const result = await generateCornerPlan(payload);

    return NextResponse.json({
      success: true,
      project: result.project,
      sceneUnderstanding: result.sceneUnderstanding,
      plan: result.plan,
      backgroundUrl: result.backgroundUrl,
      things: result.things,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成方案失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
