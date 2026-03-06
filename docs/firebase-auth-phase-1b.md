# MSM1 Firebase Auth Setup

## 1. Firebase settings to enable

In Firebase Console:

1. Create a Firebase project.
2. Add a Web App to the project.
3. Go to **Authentication** → **Sign-in method**.
4. Enable **Email/Password**.
5. Do not enable frontend registration in MSM1.
6. Keep user creation manual in Firebase Console.

## 2. Environment variables to fill in

For Phase 1B, fill these values in `.env.local`:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

## 3. Create the two users manually

In Firebase Console:

1. Open **Authentication** → **Users**.
2. Click **Add user**.
3. Enter email and password for user 1.
4. Repeat for user 2.
5. Give both users the exact email/password they should use in MSM1.

## Notes

- Dashboard access is protected by middleware plus client auth state.
- Login redirects to `/dashboard` after successful sign-in.
- If a user is not signed in, `/dashboard` redirects to `/login`.
- There is no signup page in the frontend.