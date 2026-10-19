import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const outputDir = 'public';

async function convert(input, output, options = {}) {
  await sharp(input).resize(options.width, options.height, { fit: 'cover' }).webp({ quality: 82 }).toFile(output);
  console.log(`Generated ${output}`);
}

function geoCard({ flag, country, title, subtitle, colors }) {
  const [start, end, accent] = colors;
  const escapeXml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
  return Buffer.from(`
    <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${start}"/>
          <stop offset="1" stop-color="${end}"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="630" fill="url(#bg)"/>
      <circle cx="1050" cy="70" r="250" fill="${accent}" opacity=".22"/>
      <circle cx="120" cy="610" r="280" fill="#ffffff" opacity=".08"/>
      <rect x="76" y="74" width="1048" height="482" rx="32" fill="#ffffff" opacity=".12" stroke="#ffffff" stroke-opacity=".3"/>
      <text x="120" y="190" font-family="Arial, sans-serif" font-size="78">${flag}</text>
      <text x="120" y="285" font-family="Arial, sans-serif" font-size="54" font-weight="700" fill="#ffffff">${escapeXml(country)}</text>
      <text x="120" y="368" font-family="Arial, sans-serif" font-size="42" font-weight="700" fill="#ffffff">${escapeXml(title)}</text>
      <text x="120" y="432" font-family="Arial, sans-serif" font-size="28" fill="#ffffff" opacity=".92">${escapeXml(subtitle)}</text>
      <rect x="120" y="482" width="310" height="54" rx="27" fill="#ffffff" opacity=".18"/>
      <text x="275" y="517" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#ffffff">kruthika.fun · Free 24/7</text>
    </svg>
  `);
}

await mkdir(outputDir, { recursive: true });
await convert('public/og-image.jpg', 'public/og-image.webp', { width: 1200, height: 630 });
await convert('public/icon-192.png', 'public/icon-192.webp', { width: 192, height: 192 });
await convert('public/icon-512.png', 'public/icon-512.webp', { width: 512, height: 512 });

const cards = [
  ['og-in.jpg', { flag: '🇮🇳', country: 'India', title: 'AI companionship in Hindi & English', subtitle: 'Talk, connect, and feel understood — no sign-up required.', colors: ['#ff7a18', '#138808', '#ffffff'] }],
  ['og-br.jpg', { flag: '🇧🇷', country: 'Brazil', title: 'AI companionship made for Brazil', subtitle: 'Free, warm conversation whenever you want to talk.', colors: ['#087f5b', '#1d4ed8', '#facc15'] }],
  ['og-id.jpg', { flag: '🇮🇩', country: 'Indonesia', title: 'Your free AI companion in Indonesia', subtitle: 'Meaningful conversations, available day and night.', colors: ['#dc2626', '#991b1b', '#ffffff'] }],
  ['og-ng.jpg', { flag: '🇳🇬', country: 'Nigeria', title: 'A free AI companion for Nigeria', subtitle: 'A private space to chat, reflect, and feel supported.', colors: ['#15803d', '#14532d', '#ffffff'] }],
];

for (const [filename, card] of cards) {
  await sharp(geoCard(card)).jpeg({ quality: 88, mozjpeg: true }).toFile(`${outputDir}/${filename}`);
  console.log(`Generated ${outputDir}/${filename}`);
}