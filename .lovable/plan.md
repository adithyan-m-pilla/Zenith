# Replace the app’s database with Firebase

## What will change
- Move sign-in and account recovery to Firebase Authentication, including email/password and Google sign-in.
- Move profiles, study sessions and daily totals, subjects and chapters, friend connections, and rewards progress to Cloud Firestore.
- Update the dashboard, timer, analytics, log book, syllabus, friends, rewards, and settings to read and save through Firebase.
- Keep the current Cloud database untouched until the Firebase version is configured and checked, so existing records are not discarded prematurely.

## Data and account transition
- Preserve existing records where a secure export/import path is available; match records to Firebase accounts by verified identity.
- Existing password hashes cannot be transferred through the browser. If sign-in moves, users may need to sign in with Google or reset/set a Firebase password.
- Do not delete the current database or accounts during this change.

## Technical details
- Add Firebase client setup using the project’s public web-app configuration and Firestore security rules that limit private data to its owner, while allowing only the friend information and study totals required by accepted friendships.
- Keep the existing Lovable Cloud chat function for the AI Tutor; this request is to replace the app database, not the AI service.
- Validate sign-in, study-time saving, syllabus edits, calendar backfill, and friend totals after Firebase project configuration is supplied. Firebase project credentials and a secure way to import existing records are prerequisites for completing the cutover.
