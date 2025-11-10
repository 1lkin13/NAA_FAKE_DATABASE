import { promises as fs } from 'fs';
import { UTApi } from 'uploadthing/server';

const utapi = new UTApi({
  apiKey: process.env.UPLOADTHING_SECRET,
  appId: process.env.UPLOADTHING_APP_ID,
});

export async function uploadFilesToUploadThing(filePaths, route, postId = null) {
  const fileId = postId || Date.now().toString();
  console.log('[uploadthing] uploading', { fileCount: filePaths.length, route, postId: fileId });

  const files = await Promise.all(
    filePaths.map(async (filePath, index) => {
      const buffer = await fs.readFile(filePath);
      return new File([buffer], `post-${fileId}-file-${index}.jpg`);
    })
  );

  const response = await utapi.uploadFiles(files, { route });

  const uploads = Array.isArray(response) ? response : [response];
  const urls = uploads
    .map((item) => item?.data?.url)
    .filter((url) => typeof url === 'string');

  console.log('[uploadthing] upload result', { urls, errors: uploads.filter((item) => item.error) });

  if (!urls.length) {
    const errorMessages = uploads.map((item) => item.error?.message).filter(Boolean);
    throw new Error(errorMessages.join(', ') || 'UploadThing did not return URLs');
  }

  return urls;
}

// Delete files from UploadThing by post ID
export async function deleteFilesFromUploadThing(postId) {
  if (!postId) return;

  console.log('[uploadthing] deleting files for post', postId);

  try {
    // Get all files that start with this post ID
    const { files } = await utapi.listFiles();
    const postFiles = files.filter(file => file.name.startsWith(`post-${postId}-`));

    if (postFiles.length === 0) {
      console.log('[uploadthing] no files found for post', postId);
      return;
    }

    const fileKeys = postFiles.map(file => file.key);
    await utapi.deleteFiles(fileKeys);

    console.log('[uploadthing] deleted files', fileKeys);
  } catch (error) {
    console.error('[uploadthing] delete error', error);
    // Don't throw error, just log it
  }
}

