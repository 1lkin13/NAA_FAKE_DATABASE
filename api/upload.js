// Vercel Serverless Function - Upload images
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const FILES_DIR = join(process.cwd(), 'public', 'files');

export default async function handler(req, res) {
  // CORS headers - Allow all origins and methods
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ message: 'OK' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Ensure files directory exists
    mkdirSync(FILES_DIR, { recursive: true });

    // Handle file upload (assuming multipart/form-data or base64)
    const formData = req.body;
    const file = formData?.file || formData?.image;

    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const extension = file.name?.split('.').pop() || 'jpg';
    const filename = `upload-${timestamp}-${randomStr}.${extension}`;
    const filepath = join(FILES_DIR, filename);

    // Save file (assuming base64 or buffer)
    if (typeof file === 'string') {
      // Base64 encoded
      const base64Data = file.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      writeFileSync(filepath, buffer);
    } else if (Buffer.isBuffer(file)) {
      writeFileSync(filepath, file);
    } else {
      return res.status(400).json({ error: 'Invalid file format' });
    }

    const fileUrl = `/files/${filename}`;
    return res.status(200).json({
      success: true,
      url: fileUrl,
      filename: filename,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Failed to upload file', details: error.message });
  }
}

