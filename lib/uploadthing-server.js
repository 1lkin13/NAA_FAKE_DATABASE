const { promises: fs } = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function uploadFilesToUploadThing(filePaths, route) {
  const form = new FormData();
  for (let i = 0; i < filePaths.length; i++) {
    const path = filePaths[i];
    const buffer = await fs.readFile(path);
    form.append('files', buffer, `file-${i}.jpg`);
  }
  form.append('route', route);

  const res = await fetch('https://uploadthing.com/api/uploadFiles', {
    method: 'POST',
    headers: {
      'X-Uploadthing-Api-Key': process.env.UPLOADTHING_SECRET || process.env.UPLOADTHING_TOKEN || '',
      'X-Uploadthing-App-Id': process.env.UPLOADTHING_APP_ID || '',
      'X-Uploadthing-Version': '6',
      ...form.getHeaders(),
    },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`UploadThing error: ${text}`);
  }

  const data = await res.json();
  const arr = Array.isArray(data) ? data : data.files || [];
  return arr.map((x) => x.url).filter(Boolean);
}

module.exports = { uploadFilesToUploadThing };


