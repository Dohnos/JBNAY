// Firebase Configuration
// IMPORTANT: Replace these values with your actual Firebase project config
// Go to Firebase Console > Project Settings > Your apps > Web app > Config

const firebaseConfig = {
    apiKey: "AIzaSyABez5VMSuVjionM6H6C3ScCLVqrk5LDvQ",
    authDomain: "jboard-f5adc.firebaseapp.com",
    databaseURL: "https://jboard-f5adc-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "jboard-f5adc",
    storageBucket: "jboard-f5adc.firebasestorage.app",
    messagingSenderId: "606604323018",
    appId: "1:606604323018:web:3619aa66a9f3e812572c33"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const database = firebase.database();

// Export for use in other files
window.firebaseAuth = auth;
window.firebaseDB = database;

console.log('🔥 Firebase initialized!');
