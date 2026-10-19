# 🖼️ Website Image Assets & Replacement Guide (Kruthika.fun)

> **Last updated:** 2026-08-21

This guide documents every site image asset, where it is located, its purpose, recommended dimensions/formats, and how you can replace any image simply by dropping a new file with the same name.

---

## 📁 Image Directory Structure

All site images and static visual assets live in the `public/` folder at the root of the project:

```text
public/
├── favicon.ico             # Browser tab icon (16x16, 32x32, 48x48)
├── kruthika-avatar.svg     # Default avatar profile picture (Square 1:1, 512x512)
├── chat-bg.png             # WhatsApp chat background wallpaper (Tileable/Subtle texture)
├── og-image.jpg            # Primary Social Share & OpenGraph image (1200x630, 1.91:1)
├── og-image.webp           # WebP high-performance social share card
├── og-image.png            # PNG fallback social share card
├── og-in.jpg               # India region social preview (1200x630)
├── og-br.jpg               # Brazil region social preview (1200x630)
├── og-id.jpg               # Indonesia region social preview (1200x630)
├── og-ng.jpg               # Nigeria region social preview (1200x630)
├── icon-192.png            # PWA Mobile App Icon (192x192 Square)
├── icon-192.webp           # PWA WebP Mobile App Icon (192x192 Square)
├── icon-512.png            # PWA High-Resolution App Icon / Splash (512x512 Square)
└── icon-512.webp           # PWA WebP Splash Icon (512x512 Square)
```

---

## 🔄 How to Replace Any Image

To replace any image across the entire website:
1. Prepare your new image.
2. Save it with the **exact same filename** (e.g., `og-image.jpg` or `kruthika-avatar.svg`).
3. Overwrite the file inside the `public/` directory.
4. Next.js automatically serves the updated file.

---

## 📐 Image Asset Specifications & Size Guidelines

### 1. 👸 AI Profile & Avatar Image
- **Path**: `public/kruthika-avatar.svg` (or upload avatar via Admin Panel → Profile)
- **Aspect Ratio**: `1:1` (Square)
- **Recommended Size**: `512 × 512 px` (or SVG vector)
- **Supported Formats**: `.svg`, `.png`, `.webp`, `.jpg`
- **Responsive Behavior**: All avatar containers across the chat, header, and story viewer use CSS `object-fit: cover` and `rounded-full`. Even if your replacement image has different dimensions (e.g., `800x600`), it automatically centers and crops smoothly without stretching or distortion.

### 2. 💬 Chat Background Wallpaper
- **Path**: `public/chat-bg.png`
- **Aspect Ratio**: Fluid / Tileable or Full Screen (`9:16` or `1:1` repeat pattern)
- **Recommended Size**: `1080 × 1920 px` or a subtle repeating seamless pattern (`512 × 512 px`)
- **Supported Formats**: `.png`, `.webp`, `.jpg`
- **Responsive Behavior**: Rendered with CSS `background-size: cover` and low opacity (`opacity-5` to `opacity-10`) so text remains 100% legible in both light and dark themes.

### 3. 🌐 Social Share Cards (OpenGraph & Twitter Cards)
- **Path**: `public/og-image.jpg` (also `.webp` and `.png`)
- **Aspect Ratio**: `1.91:1` (Standard Facebook/Twitter/LinkedIn card ratio)
- **Recommended Size**: `1200 × 630 px`
- **File Size**: Under 300 KB for rapid crawler extraction.
- **Tip**: Keep text and faces centered within the middle `1080 × 560 px` safe zone so social platforms don't crop critical details on mobile previews.

### 4. 📱 App Icons (PWA & iOS Home Screen)
- **Path**: `public/icon-192.png`, `public/icon-512.png`, `public/favicon.ico`
- **Aspect Ratio**: `1:1` (Square)
- **Sizes**:
  - `favicon.ico`: Multi-size `.ico` (`16x16`, `32x32`, `48x48`)
  - `icon-192.png`: `192 × 192 px`
  - `icon-512.png`: `512 × 512 px`
- **Tip**: Provide a safe margin around the logo/avatar (at least 10% padding) to look clean in both circular and squircle OS masks.

---

## 🎨 Admin Media Library (Dynamic Uploads)
For blog article images, banner creatives, and AI voice story images, you can also manage and upload them directly from the **Admin Panel**:
- **URL**: `/admin/media`
- Uploaded media is securely stored under `/uploads/` and indexed in the CMS database with automatic thumbnails and deduplication.
