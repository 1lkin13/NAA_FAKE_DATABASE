import { promises as fs } from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

export async function uploadFilesToUploadThing(filePaths, route) {
  const form = new FormData();

  for (const [index, filePath] of filePaths.entries()) {
    const buffer = await fs.readFile(filePath);
    form.append('files', buffer, `file-${index}.jpg`);
  }

  form.append('route', route);

  const response = await fetch('https://uploadthing.com/api/uploadFiles', {
    method: 'POST',
    headers: {
      'X-Uploadthing-Api-Key': process.env.UPLOADTHING_SECRET,
      'X-Uploadthing-App-Id': process.env.UPLOADTHING_APP_ID,
      'X-Uploadthing-Version': '6',
      ...form.getHeaders(),
    },
    body: form,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const data = await response.json();
  const files = Array.isArray(data) ? data : data.files || [];
  return files.map((item) => item.url).filter(Boolean);
}


