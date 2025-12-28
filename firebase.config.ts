import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBo94RyawzmA59oxREIuYEowyAouo3bgAk",
  authDomain: "liftr-55282.firebaseapp.com",
  projectId: "liftr-55282",
  storageBucket: "liftr-55282.firebasestorage.app",
  messagingSenderId: "334609976664",
  appId: "1:334609976664:web:5e79b39c7d04fac54e292d"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export default app;
