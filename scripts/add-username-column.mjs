import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://prwyomthwatitktegvhb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByd3lvbXRod2F0aXRrdGVndmhiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzc1NDM2MiwiZXhwIjoyMDg5MzMwMzYyfQ.mWXyHP_VYXeGzq3YdRjIlc4VI4tiISN2U3e_TYqqQYs';

const pgMetaUrl = `${SUPABASE_URL}/pg-meta/v1/query`;
const sql = `
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text UNIQUE;
`;

console.log('Running SQL to add username column...');

const response = await fetch(pgMetaUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'X-Connection-Encrypted': 'true',
  },
  body: JSON.stringify({ query: sql }),
});

console.log('Status:', response.status);
const text = await response.text();
console.log('Response:', text);

if (response.ok) {
  console.log('Successfully added username column to profiles table!');
} else {
  console.error('Failed to add username column.');
}
