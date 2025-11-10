// Vercel Serverless Function - Upload images
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import Busboy from 'busboy';

const FILES_DIR = join(process.cwd(), 'public', 'files');

export default async function handler(req, res) {
  // CORS headers - Allow all origins and methods
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
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

    // Handle multipart/form-data
    const contentType = req.headers['content-type'] || '';
    
    if (!contentType.includes('multipart/form-data')) {
      // Try to handle base64 or JSON
      const body = req.body;
      if (body && (body.file || body.image)) {
        const file = body.file || body.image;
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 15);
        const extension = file.name?.split('.').pop() || 'jpg';
        const filename = `upload-${timestamp}-${randomStr}.${extension}`;
        const filepath = join(FILES_DIR, filename);

        if (typeof file === 'string') {
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
      }
      return res.status(400).json({ error: 'No file provided' });
    }

    // Parse multipart/form-data using busboy
    return new Promise((resolve, reject) => {
      const busboy = Busboy({ headers: req.headers });
      let uploadedFile = null;
      let filename = null;

      busboy.on('file', (name, file, info) => {
        const { filename: originalFilename, encoding, mimeType } = info;
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 15);
        const extension = originalFilename?.split('.').pop() || 'jpg';
        filename = `upload-${timestamp}-${randomStr}.${extension}`;
        const filepath = join(FILES_DIR, filename);

        const chunks = [];
        file.on('data', (chunk) => {
          chunks.push(chunk);
        });

        file.on('end', () => {
          const buffer = Buffer.concat(chunks);
          writeFileSync(filepath, buffer);
          uploadedFile = {
            filename,
            path: filepath,
            size: buffer.length,
            mimeType,
          };
        });
      });

      busboy.on('finish', () => {
        if (uploadedFile) {
          const fileUrl = `/files/${uploadedFile.filename}`;
          resolve(
            res.status(200).json({
              success: true,
              url: fileUrl,
              filename: uploadedFile.filename,
            })
          );
        } else {
          resolve(res.status(400).json({ error: 'No file uploaded' }));
        }
      });

      busboy.on('error', (error) => {
        reject(res.status(500).json({ error: 'Upload failed', details: error.message }));
      });

      // Pipe request to busboy (works in both Node.js and Vercel)
      if (typeof req.pipe === 'function') {
        req.pipe(busboy);
      } else {
        // Fallback: read body as buffer
        const chunks = [];
        if (req.on) {
          req.on('data', (chunk) => chunks.push(chunk));
          req.on('end', () => {
            const buffer = Buffer.concat(chunks);
            busboy.end(buffer);
          });
        } else {
          // If no stream methods, try to use body directly
          if (req.body && Buffer.isBuffer(req.body)) {
            busboy.end(req.body);
          } else {
            reject(res.status(400).json({ error: 'Unable to parse request' }));
          }
        }
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Failed to upload file', details: error.message });
  }
}

