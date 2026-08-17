/**
 * Utility to resolve direct image URLs from common online hosting platforms
 * (e.g. ImgBB viewer pages like ibb.co/xxx, Google Drive, Dropbox, Imgur, Postimages)
 */

export async function resolveDirectImageUrl(inputUrl: string): Promise<string> {
  if (!inputUrl || typeof inputUrl !== 'string') return inputUrl || '';
  const trimmed = inputUrl.trim();
  if (!trimmed) return '';

  // 1. If already a direct ImgBB image URL
  if (/^https?:\/\/i\.ibb\.co\//i.test(trimmed)) {
    return trimmed;
  }

  // 2. ImgBB viewer links (e.g., https://ibb.co/d00LTQmk or https://imgbb.com/xxx)
  const ibbMatch = trimmed.match(/^https?:\/\/(?:www\.)?(?:ibb\.co|imgbb\.com)\/([a-zA-Z0-9_-]+)(?:\/[a-zA-Z0-9_.-]+)?\/?$/i);
  if (ibbMatch) {
    try {
      const response = await fetch(trimmed, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const html = await response.text();
        // Priority 1: Meta og:image tag
        const ogMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)
          || html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i);
        if (ogMatch && ogMatch[1] && ogMatch[1].startsWith('http')) {
          return ogMatch[1];
        }

        // Priority 2: link rel="image_src"
        const linkMatch = html.match(/<link\s+rel=["']image_src["']\s+href=["']([^"']+)["']/i);
        if (linkMatch && linkMatch[1] && linkMatch[1].startsWith('http')) {
          return linkMatch[1];
        }

        // Priority 3: Image inside #image-viewer-container or image-viewer
        const imgMatch = html.match(/<div[^>]*id=["']image-viewer-container["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i)
          || html.match(/<img[^>]+src=["'](https?:\/\/i\.ibb\.co\/[^"']+)["']/i);
        if (imgMatch && imgMatch[1]) {
          return imgMatch[1];
        }
      }
    } catch (err: any) {
      console.warn(`[imageResolver] Failed to resolve ibb.co URL (${trimmed}):`, err.message || err);
    }
  }

  // 3. Google Drive view/share links
  // e.g. https://drive.google.com/file/d/1a2b3c4d5e/view?usp=sharing or https://drive.google.com/open?id=1a2b3c4d5e
  const driveFileMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
  const driveIdMatch = trimmed.match(/drive\.google\.com\/(?:open\?id=|uc\?id=)([a-zA-Z0-9_-]+)/i);
  const driveId = (driveFileMatch && driveFileMatch[1]) || (driveIdMatch && driveIdMatch[1]);
  if (driveId) {
    return `https://lh3.googleusercontent.com/d/${driveId}`;
  }

  // 4. Dropbox links
  // e.g. https://www.dropbox.com/s/xyz/photo.jpg?dl=0
  if (trimmed.includes('dropbox.com')) {
    if (trimmed.includes('?dl=0')) {
      return trimmed.replace('?dl=0', '?raw=1');
    }
    if (trimmed.includes('&dl=0')) {
      return trimmed.replace('&dl=0', '&raw=1');
    }
    if (!trimmed.includes('raw=1')) {
      return trimmed.includes('?') ? `${trimmed}&raw=1` : `${trimmed}?raw=1`;
    }
    return trimmed;
  }

  // 5. Imgur links
  // e.g. https://imgur.com/aBcDeFg or https://imgur.com/gallery/aBcDeFg
  const imgurMatch = trimmed.match(/^https?:\/\/(?:i\.)?imgur\.com\/(?:gallery\/|a\/)?([a-zA-Z0-9]+)(?:\.[a-zA-Z0-9]+)?$/i);
  if (imgurMatch && imgurMatch[1] && !trimmed.includes('i.imgur.com')) {
    return `https://i.imgur.com/${imgurMatch[1]}.jpg`;
  }

  // 6. Postimages
  // e.g. https://postimg.cc/xxx
  if (/^https?:\/\/postimg\.cc\/[a-zA-Z0-9_-]+/i.test(trimmed)) {
    try {
      const response = await fetch(trimmed, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(5000)
      });
      if (response.ok) {
        const html = await response.text();
        const ogMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
        if (ogMatch && ogMatch[1]) return ogMatch[1];
      }
    } catch (err: any) {
      console.warn(`[imageResolver] Failed to resolve postimg.cc URL (${trimmed}):`, err.message || err);
    }
  }

  return trimmed;
}
