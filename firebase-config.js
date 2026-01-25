// Firebase Configuration
// Замените эти значения на ваши из Firebase Console
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Инициализация Firebase (будет загружена через CDN)
let firebaseApp = null;
let firestore = null;
let storage = null;
let auth = null;

// Проверка, загружен ли Firebase
function initFirebase() {
    if (typeof firebase === 'undefined') {
        console.warn('Firebase не загружен. Используется localStorage fallback.');
        return false;
    }

    try {
        if (!firebaseApp) {
            firebaseApp = firebase.initializeApp(firebaseConfig);
            firestore = firebase.firestore();
            storage = firebase.storage();
            auth = firebase.auth();
        }
        return true;
    } catch (error) {
        console.error('Ошибка инициализации Firebase:', error);
        return false;
    }
}

// Экспорт для использования в других файлах
window.firebaseConfig = firebaseConfig;
window.initFirebase = initFirebase;

