const API_ROOT = 'https://www.googleapis.com/youtube/v3/';
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

function typedError(code, status = 400) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

function validVideoId(videoId) {
  const value = String(videoId || '').trim();
  if (!VIDEO_ID_RE.test(value)) throw typedError('INVALID_VIDEO_ID', 400);
  return value;
}

function safeYouTubeReason(reason, status) {
  if (reason === 'commentsDisabled') return 'COMMENTS_DISABLED';
  if (reason === 'videoNotFound') return 'VIDEO_NOT_FOUND';
  if (reason === 'channelNotFound') return 'CHANNEL_NOT_FOUND';
  if (reason === 'ineligibleAccount') return 'INELIGIBLE_ACCOUNT';
  if (reason === 'forbidden') return 'YOUTUBE_FORBIDDEN';
  if (reason === 'insufficientPermissions') return 'INSUFFICIENT_PERMISSIONS';
  if (reason === 'commentTextTooLong') return 'COMMENT_TOO_LONG';
  if (reason === 'channelOrVideoIdMissing' || reason === 'invalidCommentThreadMetadata') return 'INVALID_COMMENT_METADATA';
  if (reason === 'processingFailure') return 'PROCESSING_FAILURE';
  if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') return 'QUOTA_EXCEEDED';
  if (reason === 'rateLimitExceeded') return 'RATE_LIMITED';
  if (status === 401 || reason === 'authError' || reason === 'invalidCredentials') return 'AUTH_REVOKED';
  if (status === 404) return 'VIDEO_NOT_FOUND';
  return 'YOUTUBE_ERROR';
}

async function youtubeError(response) {
  let reason = '';
  try {
    const data = await response.json();
    reason = String(data?.error?.errors?.[0]?.reason || '');
  } catch {}
  return typedError(safeYouTubeReason(reason, response.status), response.status);
}

async function youtubeFetch(path, { accessToken, method = 'GET', body, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(`${API_ROOT}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!response.ok) throw await youtubeError(response);
  if (response.status === 204) return null;
  return response.json();
}

function query(resource, entries) {
  const params = new URLSearchParams();
  for (const [key, value] of entries) params.append(key, value);
  return `${resource}?${params.toString()}`;
}

async function subscriptionState(accessToken, channelId, fetchImpl) {
  const data = await youtubeFetch(query('subscriptions', [
    ['part', 'id'],
    ['mine', 'true'],
    ['forChannelId', channelId],
    ['maxResults', '1']
  ]), { accessToken, fetchImpl });
  return Array.isArray(data?.items) && data.items.length > 0;
}

function normalizeRating(value) {
  return value === 'like' || value === 'dislike' ? value : 'none';
}

export async function resolveChannelId(accessToken, fetchImpl = fetch) {
  const data = await youtubeFetch(query('channels', [
    ['part', 'id'],
    ['forHandle', '@tifloacosta']
  ]), { accessToken, fetchImpl });
  const channelId = String(data?.items?.[0]?.id || '').trim();
  if (!channelId) throw typedError('YOUTUBE_ERROR', 502);
  return channelId;
}

export async function getAccountVideoState(accessToken, videoId, fetchImpl = fetch) {
  const id = validVideoId(videoId);
  const channelId = await resolveChannelId(accessToken, fetchImpl);
  const subscribed = await subscriptionState(accessToken, channelId, fetchImpl);
  const ratingData = await youtubeFetch(query('videos/getRating', [['id', id]]), {
    accessToken,
    fetchImpl
  });
  return {
    subscribed,
    rating: normalizeRating(ratingData?.items?.[0]?.rating)
  };
}

export async function subscribe(accessToken, fetchImpl = fetch) {
  const channelId = await resolveChannelId(accessToken, fetchImpl);
  if (await subscriptionState(accessToken, channelId, fetchImpl)) {
    return { subscribed: true, changed: false };
  }
  await youtubeFetch(query('subscriptions', [['part', 'snippet']]), {
    accessToken,
    method: 'POST',
    body: {
      snippet: {
        resourceId: {
          kind: 'youtube#channel',
          channelId
        }
      }
    },
    fetchImpl
  });
  return { subscribed: true, changed: true };
}

export async function like(accessToken, videoId, fetchImpl = fetch) {
  const id = validVideoId(videoId);
  await youtubeFetch(query('videos/rate', [
    ['id', id],
    ['rating', 'like']
  ]), { accessToken, method: 'POST', fetchImpl });
  return { rating: 'like' };
}

export async function comment(accessToken, videoId, text, fetchImpl = fetch) {
  const id = validVideoId(videoId);
  const cleanText = String(text || '').trim();
  if (!cleanText) throw typedError('INVALID_COMMENT', 400);
  const channelId = await resolveChannelId(accessToken, fetchImpl);
  await youtubeFetch(query('commentThreads', [['part', 'snippet']]), {
    accessToken,
    method: 'POST',
    body: {
      snippet: {
        channelId,
        videoId: id,
        topLevelComment: {
          snippet: { textOriginal: cleanText }
        }
      }
    },
    fetchImpl
  });
  return { commented: true };
}


function parseIsoDuration(value) {
  const match = String(value || '').match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!match) return 0;
  const days = Number(match[1] || 0);
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  const seconds = Number(match[4] || 0);
  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}

function validSearchTerm(value) {
  const queryText = String(value || '').trim().replace(/\s+/g, ' ');
  if (queryText.length < 2 || queryText.length > 100) throw typedError('INVALID_SEARCH', 400);
  return queryText;
}

function validPageToken(value) {
  const token = String(value || '').trim();
  if (!token) return '';
  if (token.length > 256 || !/^[A-Za-z0-9_-]+$/.test(token)) throw typedError('INVALID_SEARCH', 400);
  return token;
}

async function youtubeKeyFetch(path, apiKey, fetchImpl = fetch) {
  const key = String(apiKey || '').trim();
  if (!key) throw typedError('SEARCH_UNAVAILABLE', 503);
  const separator = path.includes('?') ? '&' : '?';
  const response = await fetchImpl(`${API_ROOT}${path}${separator}key=${encodeURIComponent(key)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) throw await youtubeError(response);
  return response.json();
}

export async function searchVideos(apiKey, searchTerm, pageToken = '', fetchImpl = fetch) {
  const q = validSearchTerm(searchTerm);
  const token = validPageToken(pageToken);
  const entries = [
    ['part', 'snippet'],
    ['type', 'video'],
    ['maxResults', '10'],
    ['safeSearch', 'moderate'],
    ['q', q]
  ];
  if (token) entries.push(['pageToken', token]);

  const searchData = await youtubeKeyFetch(query('search', entries), apiKey, fetchImpl);
  const searchItems = Array.isArray(searchData?.items) ? searchData.items : [];
  const ids = searchItems
    .map(item => String(item?.id?.videoId || '').trim())
    .filter(id => VIDEO_ID_RE.test(id));

  let durations = new Map();
  if (ids.length) {
    const details = await youtubeKeyFetch(query('videos', [
      ['part', 'contentDetails'],
      ['id', ids.join(',')]
    ]), apiKey, fetchImpl);
    durations = new Map((Array.isArray(details?.items) ? details.items : []).map(item => [
      String(item?.id || ''),
      parseIsoDuration(item?.contentDetails?.duration)
    ]));
  }

  return {
    items: searchItems.flatMap(item => {
      const id = String(item?.id?.videoId || '').trim();
      if (!VIDEO_ID_RE.test(id)) return [];
      const snippet = item?.snippet || {};
      return [{
        id,
        title: String(snippet.title || ''),
        channelTitle: String(snippet.channelTitle || ''),
        publishedAt: String(snippet.publishedAt || ''),
        description: String(snippet.description || ''),
        thumbnail: String(snippet?.thumbnails?.medium?.url || snippet?.thumbnails?.default?.url || ''),
        durationSeconds: durations.get(id) || 0
      }];
    }),
    nextPageToken: String(searchData?.nextPageToken || '')
  };
}
