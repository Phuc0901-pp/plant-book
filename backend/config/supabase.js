const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const WebSocket = require('ws');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

let supabase = null;
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
    realtime: { transport: WebSocket },
  });
} else {
  console.warn('ℹ️  SUPABASE_URL or SUPABASE_SERVICE_KEY not provided. Supabase storage will fallback to storageService.');
}

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
