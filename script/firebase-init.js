// Importa desde un CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.2/firebase-firestore.js";

// Configuración de tu proyecto
const firebaseConfig = {
  apiKey: "AIzaSyDk7PNHMqsERs1W6uIhGYvTn5jnUm2RyDs",
  authDomain: "vetscania-e36b4.firebaseapp.com",
  projectId: "vetscania-e36b4",
  storageBucket: "vetscania-e36b4.firebasestorage.app",
  messagingSenderId: "995123656221",
  appId: "1:995123656221:web:ac76d57dcc5c7240e538f4",
  measurementId: "G-22GZ82PVZ8"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Hacerlo accesible globalmente
window.db = db;