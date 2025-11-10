// Vercel Serverless Function - GET, POST, PUT, DELETE posts
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import Busboy from 'busboy';
import { UTApi } from 'uploadthing/server';

const DATA_FILE = join(process.cwd(), 'mock.data.production.json');
const FILES_DIR = join(process.cwd(), 'public', 'files');

function loadData() {
  try {
    const data = readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { posts: [], total: 0 };
  }
}

function saveData(data) {
  try {
    writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving data:', error);
    return false;
  }
}

const stripHtml = (html = '') => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const createDescription = (html = '') => {
  const plain = stripHtml(html);
  return plain.length > 160 ? `${plain.slice(0, 160)}...` : plain;
};
const formatSharingDate = (date) => date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
const formatSharingHour = (date) => date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
const normalizeCategory = (category) => (category === 'Announcement' ? 'Announcement' : 'News');

const normalizeGallery = (gallery) => {
  if (!gallery && gallery !== '') {
    return [];
  }
  if (Array.isArray(gallery)) {
    return gallery.filter(Boolean);
  }
  if (typeof gallery === 'string') {
    const trimmed = gallery.trim();
    if (!trimmed || trimmed === 'undefined' || trimmed === 'null') {
      return [];
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean);
      }
    } catch (error) {
      // fall through
    }
    return [trimmed];
  }
  return [];
};

const ensureFilesDir = () => {
  mkdirSync(FILES_DIR, { recursive: true });
};

const uploadthingSecret = process.env.UPLOADTHING_SECRET;
const utapi = uploadthingSecret ? new UTApi({ apiKey: uploadthingSecret }) : null;
const isReadOnlyFs = !!process.env.VERCEL;

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB per image

const uploadBuffer = async (buffer, filename, mimeType) => {
  if (utapi) {
    const blob = new Blob([buffer], { type: mimeType || 'application/octet-stream' });
    const result = await utapi.uploadFiles([{ name: filename, blob }]);
    const first = Array.isArray(result) ? result[0] : undefined;
    const fileUrl =
      first?.data?.url ??
      first?.data?.fileUrl ??
      first?.url ??
      first?.fileUrl;
    if (!fileUrl) {
      const message =
        (Array.isArray(first?.error) ? first?.error[0]?.message : first?.error?.message) ||
        (typeof first?.error === 'string' ? first.error : null) ||
        'Failed to upload image';
      throw new Error(message);
    }
    return fileUrl;
  }

  if (isReadOnlyFs) {
    throw new Error('UploadThing API key is not configured');
  }

  ensureFilesDir();
  const filepath = join(FILES_DIR, filename);
  writeFileSync(filepath, buffer);
  return `/files/${filename}`;
};

const saveBase64Image = async (imageData) => {
  if (!imageData || typeof imageData !== 'string') {
    return imageData;
  }

  if (!imageData.startsWith('data:image/')) {
    return imageData;
  }

  const [metadata, dataPart] = imageData.split(';base64,');
  if (!dataPart) {
    throw new Error('Invalid image data format');
  }

  const mimeType = metadata.replace(/^data:/, '') || 'image/png';
  const extension = mimeType.split('/')[1]?.split('+')[0] || 'png';
  const sanitized = dataPart.replace(/\s/g, '');

  let buffer;
  try {
    buffer = Buffer.from(sanitized, 'base64');
  } catch (error) {
    throw new Error('Image data is not valid base64');
  }

  if (!buffer || buffer.length === 0) {
    throw new Error('Image data is empty');
  }

  if (buffer.length > MAX_IMAGE_SIZE) {
    throw new Error('Image size exceeds 5MB limit');
  }

  const filename = `upload-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${extension}`;
  return uploadBuffer(buffer, filename, mimeType);
};

const processGalleryInput = async (gallery) => {
  const normalized = normalizeGallery(gallery);
  if (normalized.length === 0) {
    return [];
  }
  const results = [];
  for (const item of normalized) {
    const processed = await saveBase64Image(item);
    if (processed) {
      results.push(processed);
    }
  }
  return results;
};

const normalizeFieldName = (name = '') => name.replace(/\[\d+\]$/, '');

const parseMultipartForm = (req) =>
  new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers });
    const fields = {};
    const files = {};

    busboy.on('field', (name, value) => {
      const normalized = normalizeFieldName(name);
      if (Object.prototype.hasOwnProperty.call(fields, normalized)) {
        const current = fields[normalized];
        if (Array.isArray(current)) {
          current.push(value);
        } else {
          fields[normalized] = [current, value];
        }
      } else {
        fields[normalized] = value;
      }
    });

    busboy.on('file', (name, file, info) => {
      const normalized = normalizeFieldName(name);
      const chunks = [];
      file.on('data', (chunk) => chunks.push(chunk));
      file.on('error', (error) => reject(error));
      file.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (!files[normalized]) {
          files[normalized] = [];
        }
        files[normalized].push({
          buffer,
          filename: info?.filename || `upload-${Date.now()}`,
          mimeType: info?.mimeType || 'application/octet-stream',
        });
      });
    });

    busboy.on('error', (error) => reject(error));
    busboy.on('finish', () => resolve({ fields, files }));

    req.pipe(busboy);
  });

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);

const getFieldValue = (formFields, jsonFields, key) => {
  if (hasOwn(formFields, key)) {
    const value = formFields[key];
    return Array.isArray(value) ? value[value.length - 1] : value;
  }
  if (hasOwn(jsonFields, key)) {
    const value = jsonFields[key];
    return Array.isArray(value) ? value[value.length - 1] : value;
  }
  return undefined;
};

const getFieldValues = (formFields, jsonFields, key) => {
  if (hasOwn(formFields, key)) {
    const value = formFields[key];
    return Array.isArray(value) ? value : [value];
  }
  if (hasOwn(jsonFields, key)) {
    const value = jsonFields[key];
    return Array.isArray(value) ? value : [value];
  }
  return [];
};

const parseJSONField = (formFields, jsonFields, key, fallback = []) => {
  const rawValue = getFieldValue(formFields, jsonFields, key);
  if (!rawValue) return Array.isArray(fallback) ? [...fallback] : fallback;
  try {
    const parsed = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
    return Array.isArray(parsed) ? parsed.filter(Boolean) : Array.isArray(fallback) ? [...fallback] : fallback;
  } catch {
    return Array.isArray(fallback) ? [...fallback] : fallback;
  }
};

const getFileExtension = (filename = '', mimeType = '') => {
  const nameExt = filename.split('.').pop();
  if (nameExt && nameExt !== filename) {
    return nameExt.toLowerCase();
  }
  if (mimeType && mimeType.includes('/')) {
    return mimeType.split('/')[1]?.split('+')[0] || 'bin';
  }
  return 'bin';
};

const createSafeFilename = (filename = '', mimeType = '') => {
  const extension = getFileExtension(filename, mimeType) || 'bin';
  return `upload-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${extension}`;
};

const parseRequestBody = (rawBody) => {
  if (!rawBody) {
    return {};
  }
  if (typeof rawBody === 'string') {
    try {
      return JSON.parse(rawBody);
    } catch (error) {
      console.error('Failed to parse request body:', error);
      return {};
    }
  }
  return rawBody;
};

export default async function handler(req, res) {
  // CORS headers - Allow all origins and methods
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ message: 'OK' });
  }

  const data = loadData();
  const { method, query, body: rawBody } = req;
  const contentType = req.headers['content-type'] || '';

  let formFields = {};
  let fileFields = {};
  let jsonPayload = {};

  if (contentType.includes('multipart/form-data')) {
    try {
      const parsed = await parseMultipartForm(req);
      formFields = parsed.fields || {};
      fileFields = parsed.files || {};
    } catch (error) {
      console.error('Multipart parsing error:', error);
      return res.status(400).json({ error: 'Invalid multipart form data' });
    }
  } else {
    jsonPayload = parseRequestBody(rawBody);
  }

  // Extract post ID from URL path or query
  let postId = null;
  if (req.url) {
    const urlMatch = req.url.match(/\/api\/posts\/([^/?]+)/);
    if (urlMatch) {
      postId = urlMatch[1];
    }
  }
  postId = postId || query.id || (query.posts && query.posts[0]);

  // GET /api/posts
  if (method === 'GET' && !postId) {
    let posts = [...data.posts];

    if (query.type && query.type !== 'All Posts') {
      posts = posts.filter((post) => post.type === normalizeCategory(query.type));
    }

    if (query.status && query.status !== 'All Status') {
      posts = posts.filter((post) => post.status === query.status);
    }

    if (query.search) {
      const searchLower = query.search.toLowerCase();
      posts = posts.filter(
        (post) =>
          post.title.toLowerCase().includes(searchLower) ||
          (post.description || '').toLowerCase().includes(searchLower) ||
          (post.author || '').toLowerCase().includes(searchLower)
      );
    }

    posts.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    const page = parseInt(query.page || '1', 10);
    const itemsPerPage = parseInt(query.itemsPerPage || '10', 10);
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedPosts = posts.slice(startIndex, endIndex);

    return res.status(200).json({
      posts: paginatedPosts,
      total: posts.length,
    });
  }

  // GET /api/posts/:id
  if (method === 'GET' && postId) {
    const post = data.posts.find((p) => p.id === postId);
    if (post) {
      return res.status(200).json(post);
    }
    return res.status(404).json({ error: 'Post not found' });
  }

  // Handle PUT and DELETE with ID from URL
  if ((method === 'PUT' || method === 'DELETE') && !postId) {
    if (req.url) {
      const urlMatch = req.url.match(/\/api\/posts\/([^/?]+)/);
      if (urlMatch) {
        postId = urlMatch[1];
      }
    }
  }

  // POST /api/posts
  if (method === 'POST') {
    const title = (getFieldValue(formFields, jsonPayload, 'title') || '').toString().trim();
    const slugRaw = getFieldValue(formFields, jsonPayload, 'slug');
    const categoryRaw = getFieldValue(formFields, jsonPayload, 'category');
    const htmlContentRaw = getFieldValue(formFields, jsonPayload, 'htmlContent');
    const languageRaw = getFieldValue(formFields, jsonPayload, 'language');
    const statusRaw = getFieldValue(formFields, jsonPayload, 'status');
    const publishStatusRaw = getFieldValue(formFields, jsonPayload, 'publishStatus');
    const authorRaw = getFieldValue(formFields, jsonPayload, 'author');
    const existingCoverImage = getFieldValue(formFields, jsonPayload, 'existingCoverImage');
    const coverImageBase64 = getFieldValue(formFields, jsonPayload, 'coverImage');
    const galleryFiles = fileFields.galleryImages || [];
    const base64GalleryInputs = getFieldValues(formFields, jsonPayload, 'galleryImages');

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const slugValue = slugRaw ? String(slugRaw) : null;
    const htmlContentValue = htmlContentRaw !== undefined && htmlContentRaw !== null ? String(htmlContentRaw) : '';
    if (!htmlContentValue) {
      return res.status(400).json({ error: 'htmlContent is required' });
    }

    const categoryValue = categoryRaw ? String(categoryRaw) : 'News';
    const languageValue = languageRaw ? String(languageRaw) : 'AZ';
    const statusValue = statusRaw ? String(statusRaw) : 'Active';
    const publishStatusValue = publishStatusRaw ? String(publishStatusRaw) : 'Publish';
    const authorValue = authorRaw ? String(authorRaw) : 'admin';

    const coverImageFile = (fileFields.coverImage && fileFields.coverImage[0]) || null;
    let coverImagePath = '';

    try {
      if (coverImageFile && coverImageFile.buffer?.length) {
        if (coverImageFile.buffer.length > MAX_IMAGE_SIZE) {
          return res.status(400).json({ error: 'Cover image size exceeds 5MB limit' });
        }
        const safeName = createSafeFilename(coverImageFile.filename, coverImageFile.mimeType);
        coverImagePath = await uploadBuffer(
          coverImageFile.buffer,
          safeName,
          coverImageFile.mimeType || 'application/octet-stream'
        );
      } else if (coverImageBase64) {
        coverImagePath = await saveBase64Image(coverImageBase64);
      } else if (existingCoverImage) {
        coverImagePath = existingCoverImage;
      }
    } catch (error) {
      return res.status(400).json({ error: error.message || 'Invalid cover image' });
    }

    if (!coverImagePath) {
      return res.status(400).json({ error: 'Cover image is required' });
    }

    let galleryPaths = [];
    const existingGallery = parseJSONField(formFields, jsonPayload, 'existingGalleryImages', []);
    if (existingGallery.length > 0) {
      galleryPaths.push(...existingGallery);
    }

    try {
      if (base64GalleryInputs.length > 0) {
        const base64Gallery = await processGalleryInput(base64GalleryInputs);
        galleryPaths.push(...base64Gallery);
      }
      for (const galleryFile of galleryFiles) {
        if (!galleryFile?.buffer?.length) continue;
        if (galleryFile.buffer.length > MAX_IMAGE_SIZE) {
          return res.status(400).json({ error: 'Gallery image size exceeds 5MB limit' });
        }
        const safeName = createSafeFilename(galleryFile.filename, galleryFile.mimeType);
        const uploadedUrl = await uploadBuffer(
          galleryFile.buffer,
          safeName,
          galleryFile.mimeType || 'application/octet-stream'
        );
        galleryPaths.push(uploadedUrl);
      }
    } catch (error) {
      return res.status(400).json({ error: error.message || 'Invalid gallery image' });
    }

    galleryPaths = [...new Set(galleryPaths.filter(Boolean))];

    const now = new Date();
    const newPost = {
      id: `prod-${Date.now()}`,
      title,
      slug: slugValue,
      image: coverImagePath,
      description: createDescription(htmlContentValue),
      htmlContent: htmlContentValue,
      type: normalizeCategory(categoryValue),
      sharingTime: formatSharingDate(now),
      sharingHour: formatSharingHour(now),
      status: statusValue,
      publishStatus: publishStatusValue,
      author: authorValue,
      createdAt: now.toISOString(),
      language: languageValue || 'AZ',
    };

    if (galleryPaths.length > 0) {
      newPost.galleryImages = galleryPaths;
    }

    data.posts.unshift(newPost);
    data.total = data.posts.length;

    if (saveData(data)) {
      return res.status(201).json(newPost);
    }
    return res.status(500).json({ error: 'Failed to save post' });
  }

  // PUT /api/posts/:id
  if (method === 'PUT' && postId) {
    const index = data.posts.findIndex((p) => p.id === postId);
    if (index === -1) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const existingPost = data.posts[index];
    const titleRaw = getFieldValue(formFields, jsonPayload, 'title');
    const slugRaw = getFieldValue(formFields, jsonPayload, 'slug');
    const categoryRaw = getFieldValue(formFields, jsonPayload, 'category');
    const htmlContentRaw = getFieldValue(formFields, jsonPayload, 'htmlContent');
    const languageRaw = getFieldValue(formFields, jsonPayload, 'language');
    const statusRaw = getFieldValue(formFields, jsonPayload, 'status');
    const publishStatusRaw = getFieldValue(formFields, jsonPayload, 'publishStatus');
    const authorRaw = getFieldValue(formFields, jsonPayload, 'author');
    const existingCoverImage = getFieldValue(formFields, jsonPayload, 'existingCoverImage');
    const coverImageBase64 = getFieldValue(formFields, jsonPayload, 'coverImage');
    const galleryFiles = fileFields.galleryImages || [];
    const base64GalleryInputs = getFieldValues(formFields, jsonPayload, 'galleryImages');

    let coverImagePath = existingPost.image || '';
    try {
      const coverImageFile = (fileFields.coverImage && fileFields.coverImage[0]) || null;
      if (coverImageFile && coverImageFile.buffer?.length) {
        if (coverImageFile.buffer.length > MAX_IMAGE_SIZE) {
          return res.status(400).json({ error: 'Cover image size exceeds 5MB limit' });
        }
        const safeName = createSafeFilename(coverImageFile.filename, coverImageFile.mimeType);
        coverImagePath = await uploadBuffer(
          coverImageFile.buffer,
          safeName,
          coverImageFile.mimeType || 'application/octet-stream'
        );
      } else if (coverImageBase64) {
        coverImagePath = await saveBase64Image(coverImageBase64);
      } else if (existingCoverImage) {
        coverImagePath = existingCoverImage;
      }
    } catch (error) {
      return res.status(400).json({ error: error.message || 'Invalid cover image' });
    }

    if (!coverImagePath) {
      coverImagePath = existingPost.image || '';
    }

    let galleryPaths = parseJSONField(formFields, jsonPayload, 'existingGalleryImages', existingPost.galleryImages || []);
    if ((!galleryPaths || galleryPaths.length === 0) && existingPost.galleryImages?.length) {
      galleryPaths = [...existingPost.galleryImages];
    }

    try {
      if (base64GalleryInputs.length > 0) {
        const base64Gallery = await processGalleryInput(base64GalleryInputs);
        galleryPaths.push(...base64Gallery);
      }
      for (const galleryFile of galleryFiles) {
        if (!galleryFile?.buffer?.length) continue;
        if (galleryFile.buffer.length > MAX_IMAGE_SIZE) {
          return res.status(400).json({ error: 'Gallery image size exceeds 5MB limit' });
        }
        const safeName = createSafeFilename(galleryFile.filename, galleryFile.mimeType);
        const uploadedUrl = await uploadBuffer(
          galleryFile.buffer,
          safeName,
          galleryFile.mimeType || 'application/octet-stream'
        );
        galleryPaths.push(uploadedUrl);
      }
    } catch (error) {
      return res.status(400).json({ error: error.message || 'Invalid gallery image' });
    }

    galleryPaths = [...new Set((galleryPaths || []).filter(Boolean))];

    const titleValue =
      titleRaw !== undefined && titleRaw !== null ? String(titleRaw).trim() || existingPost.title : existingPost.title;
    const slugValue =
      slugRaw !== undefined && slugRaw !== null ? (slugRaw ? String(slugRaw) : null) : existingPost.slug ?? null;
    const categoryValue =
      categoryRaw !== undefined && categoryRaw !== null ? String(categoryRaw) : existingPost.type || 'News';
    const htmlContentValue =
      htmlContentRaw !== undefined && htmlContentRaw !== null
        ? String(htmlContentRaw)
        : existingPost.htmlContent || existingPost.description || '';
    const languageValue =
      languageRaw !== undefined && languageRaw !== null ? String(languageRaw) : existingPost.language || 'AZ';
    const statusValue =
      statusRaw !== undefined && statusRaw !== null ? String(statusRaw) : existingPost.status || 'Active';
    const publishStatusValue =
      publishStatusRaw !== undefined && publishStatusRaw !== null
        ? String(publishStatusRaw)
        : existingPost.publishStatus || 'Publish';
    const authorValue =
      authorRaw !== undefined && authorRaw !== null ? String(authorRaw) : existingPost.author || 'admin';

    const updatedPost = {
      ...existingPost,
      title: titleValue,
      slug: slugValue,
      type: normalizeCategory(categoryValue),
      image: coverImagePath || existingPost.image,
      htmlContent: htmlContentValue,
      language: languageValue || 'AZ',
      status: statusValue,
      publishStatus: publishStatusValue,
      author: authorValue,
    };

    if (htmlContentValue) {
      updatedPost.description = createDescription(htmlContentValue);
    }

    if (galleryPaths.length > 0) {
      updatedPost.galleryImages = galleryPaths;
    } else {
      delete updatedPost.galleryImages;
    }

    data.posts[index] = updatedPost;

    if (saveData(data)) {
      return res.status(200).json(updatedPost);
    }
    return res.status(500).json({ error: 'Failed to update post' });
  }

  // DELETE /api/posts/:id
  if (method === 'DELETE' && postId) {
    const index = data.posts.findIndex((p) => p.id === postId);
    if (index !== -1) {
      data.posts.splice(index, 1);
      data.total = data.posts.length;
      if (saveData(data)) {
        return res.status(200).json({ message: 'Post deleted' });
      }
      return res.status(500).json({ error: 'Failed to delete post' });
    }
    return res.status(404).json({ error: 'Post not found' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

