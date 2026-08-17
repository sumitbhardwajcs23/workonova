const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Synchronous client-side URL normalizer
 * Transforms known direct patterns (Google Drive, Dropbox, Imgur) instantly.
 */
export function formatImageUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // Google Drive
  const driveFileMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
  const driveIdMatch = trimmed.match(/drive\.google\.com\/(?:open\?id=|uc\?id=)([a-zA-Z0-9_-]+)/i);
  const driveId = (driveFileMatch && driveFileMatch[1]) || (driveIdMatch && driveIdMatch[1]);
  if (driveId) {
    return `https://lh3.googleusercontent.com/d/${driveId}`;
  }

  // Dropbox
  if (trimmed.includes('dropbox.com')) {
    if (trimmed.includes('?dl=0')) return trimmed.replace('?dl=0', '?raw=1');
    if (trimmed.includes('&dl=0')) return trimmed.replace('&dl=0', '&raw=1');
    if (!trimmed.includes('raw=1')) return trimmed.includes('?') ? `${trimmed}&raw=1` : `${trimmed}?raw=1`;
    return trimmed;
  }

  // Imgur
  const imgurMatch = trimmed.match(/^https?:\/\/(?:i\.)?imgur\.com\/(?:gallery\/|a\/)?([a-zA-Z0-9]+)(?:\.[a-zA-Z0-9]+)?$/i);
  if (imgurMatch && imgurMatch[1] && !trimmed.includes('i.imgur.com')) {
    return `https://i.imgur.com/${imgurMatch[1]}.jpg`;
  }

  return trimmed;
}

/**
 * Asynchronous image resolver that queries the backend to parse ImgBB (ibb.co) viewer pages
 * and other dynamic links into direct image URLs.
 */
export async function fetchDirectImageUrl(url: string): Promise<string> {
  if (!url || typeof url !== 'string') return '';
  const initial = formatImageUrl(url);
  if (!initial) return '';

  // If it's an ImgBB page URL or Postimages page URL, resolve via backend
  const needsBackendResolution =
    /^https?:\/\/(?:www\.)?(?:ibb\.co|imgbb\.com)\//i.test(initial) &&
    !/^https?:\/\/i\.ibb\.co\//i.test(initial) ||
    /^https?:\/\/postimg\.cc\//i.test(initial);

  if (!needsBackendResolution) {
    return initial;
  }

  try {
    const res = await fetch(`${API_BASE}/api/public/resolve-image?url=${encodeURIComponent(initial)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.directUrl) {
        return data.directUrl;
      }
    }
  } catch (err) {
    console.warn('[imageResolver] Backend resolve error:', err);
  }

  return initial;
}

/** Default fallback avatar for team members */
export const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80';
