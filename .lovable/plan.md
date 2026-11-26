# Move app data to Firebase while keeping existing accounts

## Scope
- Keep Lovable Cloud sign-in, password reset, Google login, and existing account IDs unchanged; Firebase replaces data storage only.
- Move profiles, study sessions and daily totals, subjects and chapters, friend connections, and saved study tasks/reward progress to Cloud Firestore.
- Keep the existing Lovable Cloud AI Tutor function and retain the current database as a fallback until migration checks pass.

## Safe access and transition
- Verify each existing signed-in user through Lovable Cloud, then issue a Firebase custom token using that same user ID; do not move passwords or credentials into Firebase.
- Store Firebase's private service-account credential only in Lovable Cloud secrets; keep the supplied web-app config in client settings, where public Firebase config is expected.
- Restrict Firestore access to each user's own records, with accepted friends limited to the profile and daily totals the Friends tab needs.
- Copy each user's existing records without deleting the source; use stable record IDs and validate copied totals before switching that user's reads and writes.

## Delivery checks
- Update the app's data access for dashboard, timer, analytics, log book, syllabus, friends, rewards, and settings.
- Verify existing sign-in still works, study time saves, calendar backfill and chapter changes persist, friend totals remain private and correct, and rewards progress persists.
- Do not remove or disable current data until the Firebase version has been checked end to end.

## Technical details
- Add Firebase client setup and an authenticated Cloud Function for the custom-token exchange; Firestore rules use the existing user UUID as the Firebase UID.
- Keep auth and AI Tutor calls on Lovable Cloud; replace only app-data queries with Firestore calls.
- Firebase project settings were supplied, but the private service credential and Firestore availability still need confirmation before secure data access can be enabled.
