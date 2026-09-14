import { parseFeedXml } from './actualidad-feed.mjs';

const cleanText = value => String(value || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\s+/g, ' ')
  .trim();

function absoluteUrl(value, base) {
  try { return new URL(String(value || '').trim(), base).toString(); }
  catch { return ''; }
}

export function feedEntriesFromXml(xml, source = {}) {
  return parseFeedXml(xml, source).map(item => ({
    title: item.title,
    originalUrl: item.url,
    publishedAt: item.publishedAt,
    summary: item.summary || '',
    platform: source.platform || 'podcast'
  }));
}

export function parseTifloAudioHtml(html) {
  const entries = [];
  const articles = [...String(html || '').matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)].map(match => match[1]);
  for (const article of articles) {
    const heading = article.match(/<h[23]\b[^>]*>[\s\S]*?<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h[23]>/i);
    const time = article.match(/<time\b[^>]*datetime=["']([^"']+)["'][^>]*>/i);
    if (!heading || !time) continue;
    const originalUrl = absoluteUrl(heading[1], 'https://www.tifloaudio.com/');
    const title = cleanText(heading[2]);
    if (!originalUrl || !title || Number.isNaN(new Date(time[1]).getTime())) continue;
    const paragraph = article.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
    const mp3 = article.match(/<a\b[^>]*href=["']([^"']+\.mp3(?:\?[^"']*)?)["'][^>]*>/i);
    entries.push({
      title,
      originalUrl,
      publishedAt: time[1],
      summary: paragraph ? cleanText(paragraph[1]) : '',
      mediaUrl: mp3 ? absoluteUrl(mp3[1], originalUrl) : null
    });
  }
  return entries;
}

export function youtubeEntriesFromApi(page = {}) {
  return (page.items || []).flatMap(item => {
    const id = String(item?.contentDetails?.videoId || '').trim();
    const title = String(item?.snippet?.title || '').trim();
    if (!/^[A-Za-z0-9_-]{11}$/.test(id) || !title || /^(deleted video|private video)$/i.test(title)) return [];
    const publishedAt = item?.contentDetails?.videoPublishedAt || item?.snippet?.publishedAt || '';
    if (Number.isNaN(new Date(publishedAt).getTime())) return [];
    return [{
      title,
      summary: String(item?.snippet?.description || '').trim(),
      publishedAt,
      originalUrl: `https://www.youtube.com/watch?v=${id}`,
      embedUrl: `https://www.youtube.com/embed/${id}`,
      platform: 'youtube'
    }];
  });
}
