import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://prwyomthwatitktegvhb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByd3lvbXRod2F0aXRrdGVndmhiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzc1NDM2MiwiZXhwIjoyMDg5MzMwMzYyfQ.mWXyHP_VYXeGzq3YdRjIlc4VI4tiISN2U3e_TYqqQYs';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const posts = [
  {
    content: '💡 Dica do dia: Pratiquem o shadowing com os áudios do WisyApp! @leonardo o que você acha?',
    user_id: '214ec809-a6fb-4054-87de-5dbaa51e46a1',
  },
  {
    content: '❓ Alguém sabe a melhor forma de usar o Anki? @aluno_premium',
    user_id: '7c1ed0a0-63a1-44e6-92bf-38620ef38926',
  },
  {
    content: '🏆 Completei 10 textos hoje! @leonardo @aluno_premium vamos com tudo!',
    user_id: '7c1ed0a0-63a1-44e6-92bf-38620ef38926',
  }
];

async function seedPosts() {
  console.log('Seeding mock posts with real IDs...');
  for (const p of posts) {
    const { error } = await supabase.from('posts').insert(p);
    if (error) console.error('Error seeding post:', error.message);
    else console.log('Seeded post');
  }
  console.log('Done!');
}

seedPosts();
