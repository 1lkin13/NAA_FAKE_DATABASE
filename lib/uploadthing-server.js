import { promises as fs } from 'fs';

export async function uploadFilesToUploadThing(filePaths, route) {
  const form = new FormData();

  for (const [index, filePath] of filePaths.entries()) {
    const buffer = await fs.readFile(filePath);
    const blob = new Blob([buffer]);
    form.append('files', blob, `file-${index}.jpg`);
  }

  form.append('route', route);

  const response = await fetch('https://uploadthing.com/api/uploadFiles', {
    method: 'POST',
    headers: {
      'X-Uploadthing-Api-Key': process.env.UPLOADTHING_SECRET,
      'X-Uploadthing-App-Id': process.env.UPLOADTHING_APP_ID,
      'X-Uploadthing-Version': '6',
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


