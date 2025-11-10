import { promises as fs } from 'fs';
import { UTApi } from 'uploadthing/server';

const utapi = new UTApi({
  apiKey: process.env.UPLOADTHING_SECRET,
  appId: process.env.UPLOADTHING_APP_ID,
});

export async function uploadFilesToUploadThing(filePaths, route) {
  console.log('[uploadthing] uploading', { fileCount: filePaths.length, route });

  const files = await Promise.all(
    filePaths.map(async (filePath, index) => {
      const buffer = await fs.readFile(filePath);
      return new File([buffer], `file-${index}.jpg`);
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

