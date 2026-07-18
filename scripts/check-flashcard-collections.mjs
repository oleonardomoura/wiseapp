import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://prwyomthwatitktegvhb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByd3lvbXRod2F0aXRrdGVndmhiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzc1NDM2MiwiZXhwIjoyMDg5MzMwMzYyfQ.mWXyHP_VYXeGzq3YdRjIlc4VI4tiISN2U3e_TYqqQYs';
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const { data: collections } = await supabase
  .from('flashcard_collections')
  .select('id, name, level')
  .order('level, name');

for (const col of collections) {
  const { count } = await supabase
    .from('flashcards')
    .select('*', { count: 'exact', head: true })
    .eq('collection_id', col.id);
  console.log(`[${col.level}] "${col.name}" → ${count} cards (id: ${col.id})`);
}

// Also show a few sample flashcards from first collection
if (collections.length > 0) {
  const { data: samples } = await supabase
    .from('flashcards')
    .select('front, back')
    .eq('collection_id', collections[0].id)
    .limit(3);
  console.log('\nSample cards from first collection:');
  for (const s of samples) {
    console.log(`  FRONT: ${s.front}`);
    console.log(`  BACK:  ${s.back}`);
    console.log('');
  }
}
