import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    service: 'cornercraft-backend',
    timestamp: new Date().toISOString(),
  });
}
