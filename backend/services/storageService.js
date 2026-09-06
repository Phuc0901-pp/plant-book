/* ═══════════════════════════════════════════════════════════════
   Plant Book – Backend
   services/storageService.js — Universal Cloud Storage Adapter
   Supports: Cloudflare R2, AWS S3, Supabase Storage, and Local Disk Fallback
   ═══════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

class StorageService {
  constructor() {
    this.driver = (process.env.STORAGE_DRIVER || 'supabase').toLowerCase();
    this.bucket = process.env.STORAGE_BUCKET_NAME || process.env.SUPABASE_BUCKET || 'plant-media';
    this.publicUrlBase = process.env.STORAGE_PUBLIC_URL || '';

    this.localUploadDir = path.join(__dirname, '../../frontend/assets/uploads');
    if (!fs.existsSync(this.localUploadDir)) {
      try {
        fs.mkdirSync(this.localUploadDir, { recursive: true });
      } catch (_) {}
    }

    // Initialize driver
    if (this.driver === 'supabase') {
      try {
        const { supabase, ensureBucket, uploadFile, deleteFile } = require('../config/supabase');
        this.supabase = supabase;
        this.ensureBucket = ensureBucket;
        this._supabaseUpload = uploadFile;
        this._supabaseDelete = deleteFile;
      } catch (err) {
        console.warn('⚠️ Supabase config not available, falling back to local storage driver.');
        this.driver = 'local';
      }
    }
  }

  /**
   * Upload file buffer to cloud or local storage
   * @param {string} objectName - Relative object path / file name
   * @param {Buffer} buffer - File binary buffer
   * @param {string} mimeType - MIME type (e.g. image/jpeg, video/mp4)
   * @returns {Promise<string>} Public URL of uploaded file
   */
  async uploadFile(objectName, buffer, mimeType) {
    if (!objectName) {
      objectName = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    // 1. Cloudflare R2 / AWS S3 via standard endpoint if configured
    if (this.driver === 'r2' || this.driver === 's3') {
      const endpoint = process.env.STORAGE_ENDPOINT;
      const accessKey = process.env.STORAGE_ACCESS_KEY_ID;
      const secretKey = process.env.STORAGE_SECRET_ACCESS_KEY;

      if (endpoint && accessKey && secretKey) {
        try {
          const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
          const s3Client = new S3Client({
            region: process.env.STORAGE_REGION || 'auto',
            endpoint: endpoint,
            credentials: { accessKeyId: accessKey, secretAccessKey: secretKey }
          });

          await s3Client.send(new PutObjectCommand({
            Bucket: this.bucket,
            Key: objectName,
            Body: buffer,
            ContentType: mimeType
          }));

          const baseUrl = this.publicUrlBase || `${endpoint}/${this.bucket}`;
          return `${baseUrl.replace(/\/$/, '')}/${objectName}`;
        } catch (err) {
          console.warn('⚠️ S3/R2 direct SDK upload failed, falling back to Supabase/Local:', err.message);
        }
      }
    }

    // 2. Supabase Storage Driver
    if (this.driver === 'supabase' && typeof this._supabaseUpload === 'function') {
      try {
        return await this._supabaseUpload(objectName, buffer, mimeType);
      } catch (err) {
        console.warn('⚠️ Supabase upload failed, falling back to local:', err.message);
      }
    }

    // 3. Local Disk Driver (Guaranteed fallback)
    try {
      const sanitizedName = objectName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const targetPath = path.join(this.localUploadDir, sanitizedName);
      const targetDir = path.dirname(targetPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.writeFileSync(targetPath, buffer);
      return `/assets/uploads/${sanitizedName}`;
    } catch (err) {
      console.error('❌ Local file write error:', err.message);
      throw new Error('Lỗi lưu trữ tệp tin: ' + err.message);
    }
  }

  /**
   * Delete file from cloud or local storage
   * @param {string} objectName
   */
  async deleteFile(objectName) {
    if (!objectName) return;

    if (this.driver === 'r2' || this.driver === 's3') {
      const endpoint = process.env.STORAGE_ENDPOINT;
      const accessKey = process.env.STORAGE_ACCESS_KEY_ID;
      const secretKey = process.env.STORAGE_SECRET_ACCESS_KEY;
      if (endpoint && accessKey && secretKey) {
        try {
          const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
          const s3Client = new S3Client({
            region: process.env.STORAGE_REGION || 'auto',
            endpoint: endpoint,
            credentials: { accessKeyId: accessKey, secretAccessKey: secretKey }
          });
          await s3Client.send(new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: objectName
          }));
          return;
        } catch (_) {}
      }
    }

    if (this.driver === 'supabase' && typeof this._supabaseDelete === 'function') {
      try {
        await this._supabaseDelete(objectName);
        return;
      } catch (_) {}
    }

    if (this.driver === 'local') {
      try {
        const sanitizedName = objectName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const targetPath = path.join(this.localUploadDir, sanitizedName);
        if (fs.existsSync(targetPath)) {
          fs.unlinkSync(targetPath);
        }
      } catch (_) {}
    }
  }
}

const storageService = new StorageService();
module.exports = storageService;
