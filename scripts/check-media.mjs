import fs from 'fs';
import path from 'path';

const loginUrl = 'http://localhost:5000/api/admin/login';
const mediaUrl = 'http://localhost:5000/api/admin/media';

async function main(){
  const loginResp = await fetch(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@kruthika.fun', password: 'habibi007isadmin' }),
  });
  if (!loginResp.ok) { console.error('Login failed', await loginResp.text()); process.exit(2); }
  const setCookie = loginResp.headers.get('set-cookie') || '';
  const cookieHeader = setCookie ? setCookie.split(/,(?=[^ ;]+=)/).map(s => s.split(';')[0]).join('; ') : '';
  console.log('COOKIE_HEADER', cookieHeader);
  const res = await fetch(mediaUrl, { headers: cookieHeader ? { Cookie: cookieHeader } : {} });
  const text = await res.text();
  console.log('MEDIA_STATUS', res.status);
  try{ const json = JSON.parse(text); console.log('MEDIA_TOTAL', json.total); console.log('ASSETS_COUNT', (json.assets||[]).length); } catch(e){ console.log('MEDIA_BODY', text); }
}

main().catch(e=>{ console.error(e); process.exit(1); });