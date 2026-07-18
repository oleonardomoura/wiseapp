/**
 * Adds public read RLS policies to flashcard tables via Supabase Management API.
 * Uses the service role to run SQL that grants anon SELECT on these tables.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://prwyomthwatitktegvhb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByd3lvbXRod2F0aXRrdGVndmhiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzc1NDM2MiwiZXhwIjoyMDg5MzMwMzYyfQ.mWXyHP_VYXeGzq3YdRjIlc4VI4tiISN2U3e_TYqqQYs';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByd3lvbXRod2F0aXRrdGVndmhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NTQzNjIsImV4cCI6MjA4OTMzMDM2Mn0.ARdkzolmMPPP7GoGW8EtRRTYO7YNIm2Wrq5qLJ1ah8Y';

// Verify anon access
console.log('=== Testing anon access to flashcard_collections ===');
const anonClient = createClient(SUPABASE_URL, ANON_KEY);
const { data: anonData, error: anonErr, count } = await anonClient
  .from('flashcard_collections')
  .select('id, name, level', { count: 'exact' });
console.log('Count:', count, '| Error:', anonErr?.message ?? 'none');
console.log('Data:', anonData?.map(c => c.name));

// Verify flashcards anon access
const { data: fcData, error: fcErr, count: fcCount } = await anonClient
  .from('flashcards')
  .select('id', { count: 'exact', head: true });
console.log('\n=== Anon access to flashcards ===');
console.log('Count:', fcCount, '| Error:', fcErr?.message ?? 'none');

// Service role
console.log('\n=== Service role access to flashcard_collections ===');
const svcClient = createClient(SUPABASE_URL, SERVICE_KEY);
const { data: svcData, error: svcErr, count: svcCount } = await svcClient
  .from('flashcard_collections')
  .select('id, name, level', { count: 'exact' });
console.log('Count:', svcCount, '| Error:', svcErr?.message ?? 'none');
console.log('Data:', svcData?.map(c => c.name));
