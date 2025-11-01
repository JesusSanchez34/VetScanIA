import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, FacebookAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import CryptoJS from "https://cdn.jsdelivr.net/npm/crypto-js@4.1.1/+esm";

// === Configuración Firebase ===
const firebaseConfig = {
  apiKey: "AIzaSyDk7PNHMqsERs1W6uIhGYvTn5jnUm2RyDs",
  authDomain: "vetscania-e36b4.firebaseapp.com",
  projectId: "vetscania-e36b4",
  storageBucket: "vetscania-e36b4.firebasestorage.app",
  messagingSenderId: "995123656221",
  appId: "1:995123656221:web:ac76d57dcc5c7240e538f4",
  measurementId: "G-22GZ82PVZ8"
};

// === Inicialización ===
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// === Función de notificación ===
function showNotification(type, message) {
  const width = 380;
  const height = 220;
  const left = (screen.width - width) / 2;
  const top = (screen.height - height) / 2;

  const errorMessages = {
    'auth/invalid-email': 'Correo electrónico no válido',
    'auth/user-disabled': 'Cuenta deshabilitada',
    'auth/user-not-found': 'Usuario no registrado',
    'auth/wrong-password': 'Contraseña incorrecta',
    'auth/email-already-in-use': 'El correo ya está registrado',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres',
    'auth/operation-not-allowed': 'Operación no permitida',
    'auth/account-exists-with-different-credential': 'El email ya está asociado a otra cuenta',
    'auth/popup-closed-by-user': 'Ventana de autenticación cerrada',
    'auth/cancelled-popup-request': 'Solicitud cancelada',
    'auth/popup-blocked': 'Permite ventanas emergentes para este sitio',
    'auth/unauthorized-domain': 'Error de configuración del dominio'
  };

  const friendlyMessage = errorMessages[type.code || type] || message;

  window.open(
    `Notification.html?type=${type.code ? 'error' : type}&message=${encodeURIComponent(friendlyMessage)}`,
    '_blank',
    `width=${width},height=${height},left=${left},top=${top},resizable=no`
  );
}

////////////////////////////////////////////////////////
// ===== REGISTRO =====
const registerForm = document.getElementById("register-form");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nombre = document.getElementById("register-name").value;
    const apellido = document.getElementById("register-lastname").value;
    const email = document.getElementById("register-email").value;
    const telefono = document.getElementById("register-phone").value;
    const pass = document.getElementById("register-password").value;
    const confirmPass = document.getElementById("register-confirm-password").value;
    const aceptarTerminos = document.getElementById("accept-terms").checked;

    if (pass !== confirmPass) return showNotification('error', 'Las contraseñas no coinciden');
    if (!aceptarTerminos) return showNotification('warning', 'Debes aceptar los términos y condiciones');

    const passHash = CryptoJS.SHA256(pass).toString();

    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, pass);
      const uid = userCred.user.uid;

      await setDoc(doc(db, "usuarios", uid), {
        uid,
        nombre,
        apellido,
        telefono,
        email,
        password: passHash,
        rol: "cliente",
        acepto_terminos: aceptarTerminos,
        creado_en: new Date()
      });

      showNotification('success', '¡Registro exitoso!');
      setTimeout(() => window.location.href = "Home.html", 1500);
    } catch (error) {
      showNotification(error, 'Error en el registro');
    }
  });
}

////////////////////////////////////////////////////////
// ===== LOGIN =====
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("login-email").value;
    const pass = document.getElementById("login-password").value;

    try {
      const userCred = await signInWithEmailAndPassword(auth, email, pass);
      const uid = userCred.user.uid;
      const docSnap = await getDoc(doc(db, "usuarios", uid));

      if (!docSnap.exists()) throw { code: 'auth/user-not-found' };

      const data = docSnap.data();
      showNotification('success', `Bienvenido Administrador:  ${data.nombre || ''}`);
      setTimeout(() => {
        window.location.href = data.rol === "admin" ? "/admin/Dashboard.html" : "/Home.html";
      }, 1200);
    } catch (error) {
      showNotification(error, 'Error al iniciar sesión');
    }
  });
}

////////////////////////////////////////////////////////
// ===== LOGIN SOCIAL =====
const handleSocialLogin = async (provider, platform) => {
  try {
    const result = await signInWithPopup(auth, provider);
    const uid = result.user.uid;
    const docSnap = await getDoc(doc(db, "usuarios", uid));

    if (!docSnap.exists()) {
      await setDoc(doc(db, "usuarios", uid), {
        uid,
        nombre: result.user.displayName || "",
        apellido: "",
        telefono: "",
        email: result.user.email || "",
        rol: "cliente",
        creado_en: new Date()
      });
    }

    showNotification('success', `Bienvenido con ${platform}`);
    setTimeout(() => window.location.href = "Home.html", 1200);
  } catch (error) {
    showNotification(error, `Error con ${platform}`);
  }
};

const googleBtn = document.querySelector(".google");
if (googleBtn) {
  googleBtn.addEventListener("click", () =>
    handleSocialLogin(new GoogleAuthProvider(), "Google")
  );
}

const facebookBtn = document.querySelector(".facebook");
if (facebookBtn) {
  facebookBtn.addEventListener("click", () =>
    handleSocialLogin(new FacebookAuthProvider(), "Facebook")
  );
}

////////////////////////////////////////////////////////
// Silencia errores de Firebase molestos
const originalConsoleError = console.error;
console.error = (...args) => {
  if (args.some(arg => arg?.includes?.("signInWithPassword"))) return;
  originalConsoleError(...args);
};

////////////////////////////////////////////////////////
// === Exporta objetos para uso en navbar u otros ===
export { auth, db };
