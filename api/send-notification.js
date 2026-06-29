/**
 * Vercel Serverless Function — FCM Push Sender
 * POST /api/send-notification
 *
 * This runs server-side so the FCM server key is never exposed to the browser.
 * Called by adminBroadcastService when the admin sends a notify command.
 *
 * Body: { tokens: string[], title: string, body: string, data?: object }
 * Returns: { success: number, failure: number, results: object[] }
 *
 * Uses FCM Legacy HTTP API (no OAuth needed, just the server key).
 * Works on Spark plan — no Cloud Functions or Blaze required.
 *
 * Environment variable required (set in Vercel dashboard or .env):
 *   FCM_SERVER_KEY = your Firebase Cloud Messaging server key
 *   Get from: Firebase Console → Project Settings → Cloud Messaging → Server key
 */

const FCM_ENDPOINT = 'https://fcm.googleapis.com/fcm/send';
const FCM_SERVER_KEY = process.env.FCM_SERVER_KEY;

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify server key is configured
  if (!FCM_SERVER_KEY) {
    console.error('[FCM] FCM_SERVER_KEY environment variable not set.');
    return res.status(500).json({ error: 'FCM server key not configured.' });
  }

  const { tokens, title, body, data = {}, clickAction = '/' } = req.body ?? {};

  if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
    return res.status(400).json({ error: 'tokens array is required and must not be empty.' });
  }
  if (!title || !body) {
    return res.status(400).json({ error: 'title and body are required.' });
  }

  // FCM allows max 1000 tokens per multicast request
  const CHUNK_SIZE = 1000;
  const chunks = [];
  for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
    chunks.push(tokens.slice(i, i + CHUNK_SIZE));
  }

  let totalSuccess = 0;
  let totalFailure = 0;
  const allResults = [];

  try {
    for (const chunk of chunks) {
      const payload = {
        registration_ids: chunk,
        notification: {
          title,
          body,
          icon: '/THUMBS_POSE__Egg_-removebg-preview.png',
          badge: '/THUMBS_POSE__Egg_-removebg-preview.png',
          click_action: clickAction,
          sound: 'default',
        },
        data: {
          ...data,
          clickAction,
          title,
          body,
        },
        priority: 'high',
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channel_id: 'skm_default',
            color: '#D71920',
          },
        },
        webpush: {
          notification: {
            title,
            body,
            icon: '/THUMBS_POSE__Egg_-removebg-preview.png',
            requireInteraction: true,
          },
          fcm_options: {
            link: clickAction,
          },
        },
      };

      const response = await fetch(FCM_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `key=${FCM_SERVER_KEY}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('[FCM] HTTP error:', response.status, errText);
        totalFailure += chunk.length;
        continue;
      }

      const result = await response.json();
      totalSuccess += result.success ?? 0;
      totalFailure += result.failure ?? 0;
      if (result.results) allResults.push(...result.results);
    }

    return res.status(200).json({
      success: totalSuccess,
      failure: totalFailure,
      total:   tokens.length,
      results: allResults,
    });

  } catch (err) {
    console.error('[FCM] send-notification error:', err);
    return res.status(500).json({ error: err.message ?? 'Internal server error' });
  }
}
