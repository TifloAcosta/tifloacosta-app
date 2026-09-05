import { readFile } from 'node:fs/promises';

const API_URL = 'https://api.pushalert.co/rest/v2/web-push/send';
const DEFAULT_ICON = 'https://tifloacosta.github.io/tifloacosta-app/tifloacosta-icon-192.png';

function fail(message) {
  throw new Error(message);
}

function validateHttpsUrl(value, label) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail(`${label} must be a valid URL.`);
  }
  if (parsed.protocol !== 'https:') fail(`${label} must use HTTPS.`);
  return parsed.href;
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    fail('Notification payload must be a JSON object.');
  }

  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const message = typeof payload.message === 'string' ? payload.message.trim() : '';
  const url = typeof payload.url === 'string' ? payload.url.trim() : '';
  const icon = typeof payload.icon === 'string' && payload.icon.trim() ? payload.icon.trim() : DEFAULT_ICON;

  if (!title) fail('Notification title is required.');
  if (!message) fail('Notification message is required.');
  if (!url) fail('Notification URL is required.');
  if (title.length > 64) fail('Notification title must be 64 characters or fewer.');
  if (message.length > 192) fail('Notification message must be 192 characters or fewer.');

  return {
    title,
    message,
    url: validateHttpsUrl(url, 'Notification URL'),
    icon: validateHttpsUrl(icon, 'Notification icon URL')
  };
}

async function main() {
  const file = process.argv[2];
  if (!file) fail('Usage: node scripts/send-pushalert.mjs <queue-file.json>');

  const apiKey = process.env.PUSHALERT_API_KEY;
  if (!apiKey) fail('PUSHALERT_API_KEY is not configured.');

  const raw = await readFile(file, 'utf8');
  const payload = validatePayload(JSON.parse(raw));

  const body = new URLSearchParams(payload);
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `api_key=${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  const responseText = await response.text();
  let result = {};
  try {
    result = JSON.parse(responseText);
  } catch {
    result = {};
  }

  if (!response.ok || result.success !== true) {
    fail(`PushAlert rejected the notification (HTTP ${response.status}).`);
  }

  console.log(`PushAlert notification sent successfully${result.id ? ` (ID ${result.id})` : ''}.`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
