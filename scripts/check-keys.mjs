import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://prwyomthwatitktegvhb.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_ukrZayob6Pkvjk3dksB-TA_44eIBBhT';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByd3lvbXRod2F0aXRrdGVndmhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NTQzNjIsImV4cCI6MjA4OTMzMDM2Mn0.ARdkzolmMPPP7GoGW8EtRRTYO7YNIm2Wrq5qLJ1ah8Y';

// Test with publishable key (what the browser uses as FALLBACK when ANON_KEY not set)
console.log('=== Testing PUBLISHABLE KEY access ===');
const publishableClient = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
const { data: pubData, error: pubErr } = await publishableClient
  .from('audio_texts')
  .select('*')
  .limit(2);
console.log('Publishable error:', pubErr?.message ?? 'none');
console.log('Publishable data:', pubData?.map(t => t.title));

// Test with anon JWT key (what we want the browser to use)
console.log('\n=== Testing ANON JWT KEY access ===');
const anonClient = createClient(SUPABASE_URL, ANON_KEY);
const { data: anonData, error: anonErr } = await anonClient
  .from('audio_texts')
  .select('*')
  .limit(2);
console.log('Anon JWT error:', anonErr?.message ?? 'none');
console.log('Anon JWT data:', anonData?.map(t => t.title));

// Check if VITE_SUPABASE_ANON_KEY would be picked up correctly
console.log('\n=== Key check ===');
console.log('First 30 chars of PUBLISHABLE_KEY:', PUBLISHABLE_KEY.substring(0, 30));
console.log('First 30 chars of ANON_KEY:', ANON_KEY.substring(0, 30));
