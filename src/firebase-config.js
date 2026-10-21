// Which Firebase project the app uses for sign-in and syncing.
// These values are not secret: Firebase designs them to be public (they ship to every visitor's browser).
// Each person's data is protected by the Firestore security rules in firestore.rules, which let a signed-in
// user read and write only their own assignments.
export const firebaseConfig = {
  apiKey: "AIzaSyAfCv79dWY_7ZTi7lDMG8UT9bpEXiPaGdE",
  authDomain: "homework-calendar-d14a5.firebaseapp.com",
  projectId: "homework-calendar-d14a5",
  storageBucket: "homework-calendar-d14a5.firebasestorage.app",
  messagingSenderId: "535446321844",
  appId: "1:535446321844:web:5c3674b4f128388abdb5e1",
};
