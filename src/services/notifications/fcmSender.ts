/**
 * FCM SENDER — CLIENT STUB
 *
 * The client NEVER sends FCM pushes directly.
 * All push delivery is handled exclusively by Firebase Cloud Functions
 * (functions/src/index.ts) using the Admin SDK with service account credentials.
 *
 * Client responsibility:
 *   1. Register device via getToken() with VAPID key → save fcmToken to Firestore
 *   2. Write notification docs to Firestore notifications/{id}
 *   3. Cloud Function onNotificationCreated triggers → reads fcmToken → sends push
 *
 * This file exists only as a type-export so other files that previously imported
 * sendFCM/getTokenForUser still compile after the refactor.
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';

/**
 * Get the FCM registration token stored in Firestore for a user.
 * Used by loginNotificationService to confirm the token exists before
 * writing the notification doc (so we don't write pointlessly).
 */
export async function getTokenForUser(uid: string): Promise<string | null> {
  try {
    const snap  = await getDoc(doc(db, 'users', uid));
    const token = snap.data()?.fcmToken as string | undefined;
    return (token && token.length > 10) ? token : null;
  } catch {
    return null;
  }
}

/**
 * Get all users with a registered FCM token.
 * Used by the debug command to report token counts.
 */
export async function getAllTokens(): Promise<{ uid: string; fcmToken: string }[]> {
  try {
    const { collection, getDocs, query, where } = await import('firebase/firestore');
    const snap = await getDocs(
      query(collection(db, 'users'), where('fcmToken', '!=', null))
    );
    const results: { uid: string; fcmToken: string }[] = [];
    snap.forEach(d => {
      const token = d.data().fcmToken as string | undefined;
      if (token && token.length > 10) results.push({ uid: d.id, fcmToken: token });
    });
    return results;
  } catch {
    return [];
  }
}
