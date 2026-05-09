import admin from 'firebase-admin';

let initialized = false;
let firebaseApp: admin.app.App | null = null;

function init(): admin.app.App | null {
  if (initialized) return firebaseApp;
  initialized = true;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    console.log('[push] Firebase admin env not configured — push disabled');
    return null;
  }

  // Railway-style env vars escape newlines as \n literals
  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

  try {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
    console.log('[push] Firebase admin initialized');
    return firebaseApp;
  } catch (e: any) {
    console.error('[push] Firebase init failed:', e.message || e);
    return null;
  }
}

export function isPushAvailable(): boolean {
  return init() !== null;
}

export interface PublicFirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  messagingSenderId: string;
  appId: string;
  vapidKey: string;
}

export function getPublicConfig(): PublicFirebaseConfig {
  return {
    apiKey: process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.FIREBASE_APP_ID || '',
    vapidKey: process.env.FIREBASE_VAPID_KEY || '',
  };
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  eventId: number;
}

export interface PushResult {
  ok: boolean;
  invalidToken?: boolean;
  error?: string;
}

export async function sendPush(token: string, payload: PushPayload): Promise<PushResult> {
  const app = init();
  if (!app) return { ok: false, error: 'not_configured' };

  try {
    await admin.messaging(app).send({
      token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        url: payload.url,
        eventId: String(payload.eventId),
      },
      webpush: {
        fcmOptions: {
          link: payload.url,
        },
        notification: {
          icon: '/favicon.ico',
          badge: '/favicon.ico',
        },
      },
    });
    return { ok: true };
  } catch (e: any) {
    const code: string = e?.errorInfo?.code || e?.code || '';
    const invalidToken =
      code === 'messaging/registration-token-not-registered'
      || code === 'messaging/invalid-registration-token'
      || code === 'messaging/invalid-argument';
    return { ok: false, invalidToken, error: code || e?.message || 'unknown' };
  }
}
