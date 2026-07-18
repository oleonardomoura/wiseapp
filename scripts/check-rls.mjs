import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://prwyomthwatitktegvhb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByd3lvbXRod2F0aXRrdGVndmhiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzc1NDM2MiwiZXhwIjoyMDg5MzMwMzYyfQ.mWXyHP_VYXeGzq3YdRjIlc4VI4tiISN2U3e_TYqqQYs';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByd3lvbXRod2F0aXRrdGVndmhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NTQzNjIsImV4cCI6MjA4OTMzMDM2Mn0.ARdkzolmMPPP7GoGW8EtRRTYO7YNIm2Wrq5qLJ1ah8Y';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const anonClient = createClient(SUPABASE_URL, ANON_KEY);

console.log('=== Testing ANON access to audio_texts ===');
const { data: anonData, error: anonErr, count: anonCount } = await anonClient
  .from('audio_texts')
  .select('*', { count: 'exact' })
  .limit(2);
console.log('Anon count:', anonCount, '| error:', anonErr?.message ?? 'none');
console.log('Anon data:', anonData?.map(t => t.title));

console.log('\n=== Testing SERVICE ROLE access to audio_texts ===');
const { data: svcData, error: svcErr, count: svcCount } = await supabase
  .from('audio_texts')
  .select('*', { count: 'exact' })
  .limit(2);
console.log('Service count:', svcCount, '| error:', svcErr?.message ?? 'none');
console.log('Service data:', svcData?.map(t => t.title));
