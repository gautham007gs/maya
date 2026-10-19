import fs from 'fs';
import path from 'path';

const base = process.cwd();
const tmp = path.join(base, 'tmp-sample.png');
const imgb64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
fs.writeFileSync(tmp, Buffer.from(imgb64, 'base64'));
console.log('Wrote sample image:', tmp);

const baseUrl = process.env.SMOKE_BASE_URL || 'http://localhost:5000';
const loginUrl = `${baseUrl}/api/admin/login`;
const uploadUrl = `${baseUrl}/api/upload`;

const adminEmail = process.env.SMOKE_ADMIN_EMAIL || process.env.ADMIN_EMAIL;
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;

async function main() {
  if (process.env.NODE_ENV === 'production' && !process.env.SMOKE_ALLOW_PRODUCTION) {
    console.error('Refusing to run smoke upload against production. Set SMOKE_ALLOW_PRODUCTION=1 to override.');
    process.exit(2);
  }

  if (!adminEmail || !adminPassword) {
    console.error('Set SMOKE_ADMIN_EMAIL and SMOKE_ADMIN_PASSWORD (or ADMIN_EMAIL / ADMIN_PASSWORD for local dev).');
    process.exit(2);
  }

  const loginResp = await fetch(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  });
  const loginText = await loginResp.text();
  console.log('LOGIN_STATUS', loginResp.status);
  console.log('LOGIN_BODY', loginText);
  if (!loginResp.ok) process.exit(3);

  const setCookie = loginResp.headers.get('set-cookie');
  if (!setCookie) { console.warn('No Set-Cookie header from login'); }
  const cookieHeader = setCookie ? setCookie.split(/,(?=[^ ;]+=)/).map(s => s.split(';')[0]).join('; ') : '';
  console.log('COOKIE_HEADER', cookieHeader);

  const form = new FormData();
  form.append('type', 'image');
  const buffer = fs.readFileSync(tmp);
  form.append('file', new Blob([buffer], { type: 'image/png' }), 'tmp-sample.png');

  const uploadResp = await fetch(uploadUrl, {
    method: 'POST',
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
    body: form,
  });
  const uploadText = await uploadResp.text();
  console.log('UPLOAD_STATUS', uploadResp.status);
  console.log('UPLOAD_BODY', uploadText);
  if (!uploadResp.ok) { process.exit(4); }

  const uploadJson = JSON.parse(uploadText);
  if (uploadJson.url) {
    const url = uploadJson.url.startsWith('/') ? baseUrl + uploadJson.url : uploadJson.url;
    console.log('ASSET_URL', url);
    const assetResp = await fetch(url);
    console.log('ASSET_FETCH_STATUS', assetResp.status);

    const mediaResp = await fetch(`${baseUrl}/api/admin/media`, { headers: cookieHeader ? { Cookie: cookieHeader } : {} });
    const mediaText = await mediaResp.text();
    try {
      const mediaJson = JSON.parse(mediaText);
      console.log('MEDIA_TOTAL', mediaJson.total, 'ASSETS', mediaJson.assets.length);
      const found = mediaJson.assets.find(a => a.public_url === uploadJson.url || a.storage_path === uploadJson.path);
      console.log('FOUND_IN_MEDIA_LIST', !!found);
      if (found) {
        console.log('FOUND_ID', found.id);
        const delResp = await fetch(`${baseUrl}/api/admin/media`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', ...(cookieHeader ? { Cookie: cookieHeader } : {}) },
          body: JSON.stringify({ ids: [found.id] }),
        });
        const delText = await delResp.text();
        console.log('DELETE_STATUS', delResp.status, 'BODY', delText);
        const rel = uploadJson.path.replace(/\//g, path.sep);
        const cmsPath = path.join(process.cwd(), '.cms-media', rel);
        const publicPath = path.join(process.cwd(), 'public', 'uploads', rel);
        console.log('CHECK_CMS_PATH', cmsPath, fs.existsSync(cmsPath));
        console.log('CHECK_PUBLIC_PATH', publicPath, fs.existsSync(publicPath));
      }
    } catch { console.warn('Invalid media JSON', mediaText); }
  }

  try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  console.log('SMOKE_DONE');
}

main().catch(err => { console.error('ERROR', err); process.exit(1); });
