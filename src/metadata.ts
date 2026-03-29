import { MetadataResult } from './types';

function extractOpenGraph(html: string): Partial<MetadataResult> {
  const get = (prop: string): string | null => {
    const m = html.match(new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
      || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${prop}["']`, 'i'));
    return m ? m[1].trim() : null;
  };
  return {
    title: get('title'),
    heroImage: get('image'),
    eventDate: null,
    location: null,
  };
}

function extractJsonLd(html: string): Partial<MetadataResult> {
  const result: Partial<MetadataResult> = {};
  const scriptMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of scriptMatches) {
    try {
      const data = JSON.parse(match[1]);
      const obj = Array.isArray(data) ? data[0] : data;
      if (obj.name) result.title = obj.name;
      if (obj.image) result.heroImage = typeof obj.image === 'string' ? obj.image : obj.image?.url || null;
      if (obj.startDate) result.eventDate = obj.startDate;
      if (obj.location) {
        result.location = obj.location?.name || obj.location?.address?.addressLocality || null;
      }
    } catch (_) {}
  }
  return result;
}

function extractDomFallback(html: string): Partial<MetadataResult> {
  const result: Partial<MetadataResult> = {};

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) result.title = titleMatch[1].trim();

  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
  if (imgMatch) result.heroImage = imgMatch[1];

  const datePatterns = [
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i,
    /(\d{4}-\d{2}-\d{2})/,
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
  ];
  for (const p of datePatterns) {
    const m = html.replace(/<[^>]+>/g, ' ').match(p);
    if (m) { result.eventDate = m[1]; break; }
  }

  return result;
}

export function extractMetadata(html: string): MetadataResult {
  const og = extractOpenGraph(html);
  const ld = extractJsonLd(html);
  const dom = extractDomFallback(html);

  return {
    title: og.title || ld.title || dom.title || null,
    heroImage: og.heroImage || ld.heroImage || dom.heroImage || null,
    eventDate: ld.eventDate || og.eventDate || dom.eventDate || null,
    location: ld.location || og.location || dom.location || null,
  };
}

export function sanitizeMetadata(meta: MetadataResult): MetadataResult {
  return {
    title: meta.title?.slice(0, 200) || null,
    heroImage: meta.heroImage?.startsWith('http') ? meta.heroImage.slice(0, 500) : null,
    eventDate: meta.eventDate?.slice(0, 100) || null,
    location: meta.location?.slice(0, 200) || null,
  };
}
