import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

type SupabaseAdminClient = ReturnType<typeof createClient<Database>>;

let adminClient: SupabaseAdminClient | null = null;

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`缺少环境变量 ${name}`);
  }
  return value;
}

export function getSupabaseAdmin() {
  if (adminClient) return adminClient;

  adminClient = createClient<Database>(
    requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  return adminClient;
}
