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

async function youtubeError(response) {
  let reason = '';
  try {
    const data = await response.json();
    reason = String(data?.error?.errors?.[0]?.reason || '');
  } catch {}

  let code = 'YOUTUBE_ERROR';
  if (reason === 'commentsDisabled') code = 'COMMENTS_DISABLED';
  else if (reason === 'videoNotFound' || response.status === 404) code = 'VIDEO_NOT_FOUND';
  else if (response.status === 401 || reason === 'authError' || reason === 'invalidCredentials') code = 'AUTH_REVOKED';
  return typedError(code, response.status);
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
