import { auth, db } from "./auth.js"; // ✅ Importación única y correcta
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";


onAuthStateChanged(auth, async (user) => {
    const loginBtn = document.querySelector(".login-btn");
    const userMenu = document.getElementById("user-menu");
    const avatar = document.getElementById("user-avatar");

    if (user) {
        if (loginBtn) loginBtn.style.display = "none";

        let profilePhoto = user.photoURL;
        let displayName = user.displayName;

        // Si se registró con email y contraseña, obtén nombre desde Firestore
        if (!profilePhoto) {
            const docRef = doc(db, "usuarios", user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                displayName = data.nombre || "Usuario";
            }
        }

        // Establece imagen de avatar
        if (profilePhoto) {
            avatar.innerHTML = `<img src="${profilePhoto}" alt="Perfil" style="width:100%; height:100%; border-radius:50%;">`;
        } else {
            avatar.innerHTML = `<img src="imagenes/default_user_icon.jpg" alt="Perfil" style="width:100%; height:100%; border-radius:50%;">`;
        }

        avatar.title = displayName ?? "Perfil";
        userMenu.classList.remove("hidden");
    } else {
        if (loginBtn) loginBtn.style.display = "inline-block";
        userMenu.classList.add("hidden");
    }
});


// Toggle del menú desplegable
document.getElementById("user-avatar").addEventListener("click", () => {
    document.getElementById("user-menu").classList.toggle("show");
});

// Logout
document.getElementById("logout-btn").addEventListener("click", async (e) => {
  e.preventDefault();
  await signOut(auth);
  // Esto borra el historial y redirige
  window.location.replace("index.html");
});

