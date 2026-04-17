import { NextRequest, NextResponse } from 'next/server';
import { getCornerProjectById } from '@/lib/corner/service';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const project = await getCornerProjectById(id);
    return NextResponse.json({ success: true, project });
  } catch (error) {
    const message = error instanceof Error ? error.message : '读取项目详情失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
