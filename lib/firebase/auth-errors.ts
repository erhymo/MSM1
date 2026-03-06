import { FirebaseError } from "firebase/app";

export function getFirebaseAuthErrorMessage(error: unknown) {
  if (!(error instanceof FirebaseError)) {
    return "Unable to sign in. Please try again.";
  }

  switch (error.code) {
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password.";
    case "auth/user-disabled":
      return "This user has been disabled in Firebase Auth.";
    case "auth/too-many-requests":
      return "Too many login attempts. Try again again in a little while.";
    default:
      return "Unable to sign in. Please try again.";
  }
}