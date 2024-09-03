import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyAooy_CAPiLj7S5V5Z4psHcsqiSRnO1ujc",
  authDomain: "pricingai-502bd.firebaseapp.com",
  databaseURL: "https://pricingai-502bd-default-rtdb.firebaseio.com", // Add this line
  projectId: "pricingai-502bd",
  storageBucket: "pricingai-502bd.appspot.com",
  messagingSenderId: "995785665094",
  appId: "1:995785665094:web:36b1774ab99ff20a4b3847",
  measurementId: "G-NFDVQR6RY1"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export { database };