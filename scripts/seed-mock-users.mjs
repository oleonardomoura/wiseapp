import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://prwyomthwatitktegvhb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByd3lvbXRod2F0aXRrdGVndmhiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzc1NDM2MiwiZXhwIjoyMDg5MzMwMzYyfQ.mWXyHP_VYXeGzq3YdRjIlc4VI4tiISN2U3e_TYqqQYs';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const mocks = [
  { id: '00000000-0000-0000-0000-000000000001', full_name: 'Ana Silva', username: '@ana_silva', cefr_level: 'B1' },
  { id: '00000000-0000-0000-0000-000000000002', full_name: 'João Pedro', username: '@joao_p', cefr_level: 'A2' },
  { id: '00000000-0000-0000-0000-000000000003', full_name: 'Maria Oliveira', username: '@maria_oli', cefr_level: 'C1' },
];

console.log('Seeding mock profiles for mentions...');

for (const m of mocks) {
  const { error } = await supabase.from('profiles').upsert(m);
  if (error) console.error(`Error seeding ${m.username}:`, error.message);
  else console.log(`Seeded ${m.username}`);
}

console.log('Done!');
