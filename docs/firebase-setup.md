# The Firebase project

Signed in, the app keeps each household's data in Cloud Firestore and signs in with Google through Firebase Auth. Everything fits the free Spark plan. Signed out, the app works as before, with everything kept on the phone.

The project is set up already (`meal-planner-8e85f`, Firestore in `me-west1`); its public web config is in `web/src/firebase.ts`. The values there identify the project and are not secrets. To set up another one in the [Firebase console](https://console.firebase.google.com/):

1. **Create a project** (Google Analytics is not needed).
2. **Add a web app** (Project settings > Your apps > Web). Copy `apiKey`, `authDomain`, `projectId` and `appId` into `web/src/firebase.ts`.
3. **Authentication > Sign-in method**: enable **Google**.
4. **Authentication > Settings > Authorized domains**: add the GitHub Pages domain (`<owner>.github.io`). `localhost` is there already for development.
5. **Firestore Database**: create a database in production mode, in a region near the users.
6. **Firestore Database > Rules**: replace them with [`firestore.rules`](../firestore.rules) and publish. Or, with the Firebase CLI: `npx firebase-tools deploy --only firestore:rules --project <project-id>`.

## Data layout

`users/{uid}/entries/{escaped key}`, one document `{ key, value, modifiedAt }` per storage key, written through `web/src/storage/firestore.ts`. Each key is one change in the household's log (`changes:<id>`), written once and never updated. The app listens to the collection, so changes from other phones appear live, and on each start it asks the server only for changes newer than the ones it already has.

Signing in moves the changes made on the phone while signed out into the account. The log only grows, so this never overwrites what the account already has: two households' worth of meals simply add up.

## Tests

The driver has its own tests against the Firestore emulator: `npm run test:emulator` in `web/` (needs Java 21). CI runs them.
