import { supabase } from '@/integrations/supabase/client';

export async function invokeEdgeFunction<TData = unknown>(
  functionName: string,
  body: unknown
) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  return supabase.functions.invoke<TData>(functionName, {
    body,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
}

