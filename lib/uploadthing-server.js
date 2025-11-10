import { promises as fs } from 'fs';
import { Readable } from 'stream';

export async function uploadFilesToUploadThing(filePaths, route) {
  const boundary = `----UploadThingBoundary${Date.now()}`;
  const parts = [];

  for (const [index, filePath] of filePaths.entries()) {
    const buffer = await fs.readFile(filePath);

    parts.push(Buffer.from(`--${boundary}\r\n`));
    parts.push(
      Buffer.from(
        `Content-Disposition: form-data; name="files"; filename="file-${index}.jpg"\r\n` +
          'Content-Type: application/octet-stream\r\n\r\n'
      )
    );
    parts.push(buffer);
    parts.push(Buffer.from('\r\n'));
  }

  parts.push(Buffer.from(`--${boundary}\r\n`));
  parts.push(
    Buffer.from(`Content-Disposition: form-data; name="route"\r\n\r\n${route}\r\n`)
  );
  parts.push(Buffer.from(`--${boundary}--\r\n`));

  const bodyStream = Readable.from(parts);

  const response = await fetch('https://uploadthing.com/api/uploadFiles', {
    method: 'POST',
    headers: {
      'X-Uploadthing-Api-Key': process.env.UPLOADTHING_SECRET,
      'X-Uploadthing-App-Id': process.env.UPLOADTHING_APP_ID,
      'X-Uploadthing-Version': '6',
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: bodyStream,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const data = await response.json();
  const files = Array.isArray(data) ? data : data.files || [];
  return files.map((item) => item.url).filter(Boolean);
}


