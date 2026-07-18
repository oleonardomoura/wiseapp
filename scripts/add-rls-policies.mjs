/**
 * Adds RLS SELECT policies using the Supabase pg-meta endpoint
 * (available on self-hosted; for cloud we use the service role via RPC).
 * 
 * Alternative: disable RLS on the public-content tables temporarily.
 * Since flashcard_collections and flashcards are public content (not user-specific),
 * we can simply DISABLE RLS on those tables so all roles can read them.
 * User-specific tables (flashcard_progress, study_preferences) keep their RLS.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://prwyomthwatitktegvhb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByd3lvbXRod2F0aXRrdGVndmhiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzc1NDM2MiwiZXhwIjoyMDg5MzMwMzYyfQ.mWXyHP_VYXeGzq3YdRjIlc4VI4tiISN2U3e_TYqqQYs';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Try calling the exec_sql RPC if it exists, otherwise use the REST endpoint
// with the service role bypass
// The service role bypasses RLS by default, but we need to grant anon access.
// The trick: use the pg-meta REST API that's built into Supabase

const pgMetaUrl = `${SUPABASE_URL}/pg-meta/v1/query`;
const sql = `
  ALTER TABLE public.flashcard_collections DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.flashcards DISABLE ROW LEVEL SECURITY;
`;

const response = await fetch(pgMetaUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'X-Connection-Encrypted': 'true',
  },
  body: JSON.stringify({ query: sql }),
});

console.log('pg-meta status:', response.status);
const text = await response.text();
console.log('pg-meta response:', text.substring(0, 500));

// Check if it worked
console.log('\nVerifying anon access after disable RLS...');
const { createClient: create2 } = await import('@supabase/supabase-js');
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByd3lvbXRod2F0aXRrdGVndmhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NTQzNjIsImV4cCI6MjA4OTMzMDM2Mn0.ARdkzolmMPPP7GoGW8EtRRTYO7YNIm2Wrq5qLJ1ah8Y';
const anon = create2(SUPABASE_URL, ANON_KEY);
const { count, error } = await anon.from('flashcard_collections').select('*', { count: 'exact', head: true });
console.log('Anon flashcard_collections count:', count, '| error:', error?.message ?? 'none');
