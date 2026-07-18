import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://prwyomthwatitktegvhb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByd3lvbXRod2F0aXRrdGVndmhiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzc1NDM2MiwiZXhwIjoyMDg5MzMwMzYyfQ.mWXyHP_VYXeGzq3YdRjIlc4VI4tiISN2U3e_TYqqQYs';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function setupBucket() {
  console.log('Creating community-posts bucket...');
  const { data, error } = await supabase.storage.createBucket('community-posts', {
    public: true,
    fileSizeLimit: 2097152, // 2MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/jpg'],
  });

  if (error) {
    if (error.message.includes('already exists')) {
      console.log('Bucket already exists.');
    } else {
      console.error('Error creating bucket:', error.message);
    }
  } else {
    console.log('Bucket created successfully!');
  }
}

setupBucket();
