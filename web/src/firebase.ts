// The Firebase project that holds sign-in and the user's data. Created on first use, so
// tests and screens that never touch the cloud don't start Firebase.
import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import {
  CACHE_SIZE_UNLIMITED,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'

// The web app's public config from the Firebase console (Project settings > Your apps).
// These values identify the project; they are not secrets. Access is guarded by
// firestore.rules at the repository root.
const config: FirebaseOptions = {
  apiKey: 'AIzaSyCyJtMMNcstvrG6glBBW7_I6NCTHL75TWQ',
  authDomain: 'meal-planner-8e85f.firebaseapp.com',
  projectId: 'meal-planner-8e85f',
  appId: '1:835123507077:web:7e7f59b155466d56a9deec',
}

type Firebase = { app: FirebaseApp; auth: Auth; db: Firestore }
let firebase: Firebase | undefined

export function getFirebase(): Firebase {
  if (!firebase) {
    const app = initializeApp(config)
    firebase = {
      app,
      auth: getAuth(app),
      // Keep a copy on the device so the planner opens and saves offline, and syncs later.
      // Never evicted: the storage driver reads only what is newer than this copy.
      db: initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
          cacheSizeBytes: CACHE_SIZE_UNLIMITED,
        }),
      }),
    }
  }
  return firebase
}
