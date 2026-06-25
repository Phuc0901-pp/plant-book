const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('\n❌ ERROR: Thieu SUPABASE_URL hoac SUPABASE_SERVICE_KEY trong file .env!');
  console.error('👉 Vui long tao file .env trong thu muc backend (sao chep tu .env.example) va dien day du cac thong tin ket noi Supabase.\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BUCKET = process.env.SUPABASE_BUCKET || 'plant-media';

async function ensureBucket() {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets && buckets.find(b => b.name === BUCKET);
    if (!exists) {
      const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
      if (error) throw error;
      console.log(`✅ Supabase bucket "${BUCKET}" created`);
    } else {
      console.log(`✅ Supabase bucket "${BUCKET}" already exists`);
    }
  } catch (err) {
    console.error('❌ Supabase bucket error:', err.message);
    throw err;
  }
}

async function uploadFile(objectName, buffer, mimetype) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(objectName, buffer, {
      contentType: mimetype,
      upsert: true,
    });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectName);
  return data.publicUrl;
}

async function deleteFile(objectName) {
  try {
    const { error } = await supabase.storage.from(BUCKET).remove([objectName]);
    if (error) console.error('Supabase delete error:', error.message);
  } catch (err) {
    console.error('Supabase delete error:', err.message);
  }
}

module.exports = { supabase, ensureBucket, uploadFile, deleteFile, BUCKET };
