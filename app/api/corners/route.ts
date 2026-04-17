import { NextResponse } from 'next/server';
import { listCornerProjects } from '@/lib/corner/service';

export async function GET() {
  try {
    const projects = await listCornerProjects();
    return NextResponse.json({ success: true, projects });
  } catch (error) {
    const message = error instanceof Error ? error.message : '读取项目列表失败';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
