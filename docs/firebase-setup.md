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

Each change log is a collection of documents `{ key, value, modifiedAt }`, one per storage key, written through `web/src/storage/firestore.ts`. Each key is one change (`changes:<id>`), written once and never updated. The app listens to the collection, so changes from other phones appear live, and on each start it asks the server only for changes newer than the ones it already has.

- `users/{uid}/entries/{escaped key}`: a person's own plan ("Just me"). Only they can use it.
- `tenants/{id}`: a shared plan: `{ name, owner, members: [uid], names: {uid: name}, invited: [email] }`. Who may use it is access control that the rules read, so this one document is updated in place rather than logged.
- `tenants/{id}/entries/{escaped key}`: the shared plan's change log, which its members can read and write.

Sharing starts a shared plan as a copy of the plan shown; the owner invites people by their Google account's email. An invited person sees the invite when they sign in, and joining adds them to `members`. Members can leave; the owner can take back invites and remove members. The phone remembers which plan it showed last.

Signing in moves the changes made on the phone while signed out into the person's own plan. The log only grows, so this never overwrites what the account already has.

**Deploying rules:** whenever `firestore.rules` changes, publish it before (or with) the app that needs it: `npx firebase-tools deploy --only firestore:rules --project meal-planner-8e85f`, or paste it into Firestore Database > Rules.

## Tests

The driver and the access rules have their own tests against the Firestore emulator: `npm run test:emulator` in `web/` (needs Java 21). CI runs them.
