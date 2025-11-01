import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.2/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.2/firebase-storage.js";

/* =======================
   Refs y estado
======================= */
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-message");
const messagesContainer = document.getElementById("chatbot-messages");
const suggestionBtns = document.querySelectorAll(".suggestion-btn");
const attachBtn = document.getElementById("attach-image");
const imageInput = document.getElementById("image-input");
const storage = getStorage();

// Chip (modo normal)
const chip = document.getElementById("attachment-chip");
const chipThumb = document.getElementById("attachment-thumb");
const chipName = document.getElementById("attachment-name");
const chipRemove = document.getElementById("remove-attachment");

// Card modo imagen
const imageModeCard   = document.getElementById("image-mode-card");
const imageModeTitle  = document.getElementById("image-mode-title");
const imageModeReason = document.getElementById("image-mode-reason");
const imageModePreview= document.getElementById("image-mode-preview");
const imageModeDrop   = document.getElementById("image-mode-drop");
const imageModeSend   = document.getElementById("image-mode-send");
const imageModeCancel = document.getElementById("image-mode-cancel");

// Contenedor (para togglear clases CSS si quieres)
const container = document.getElementById("chatbot-container");

// Estado
let pendingImageFile = null;
let pendingImageURL  = null;
let imageRequestActive = false;

// ¿También analizar imágenes en modo normal?
const ANALYZE_IMAGES_IN_NORMAL_MODE = false;

/* =======================
   FAQ
======================= */
const preguntasFrecuentes = [
  "¿Cuándo debo vacunar a mi perro?",
  "Mi gato no quiere comer, ¿qué hago?",
  "¿Cuáles son los síntomas de alergia en mascotas?",
  "¿Cada cuánto debo bañar a mi perro?",
  "Mi perro tiene diarrea, ¿es grave?",
  "¿Qué vacunas son obligatorias para gatos?",
  "¿Cómo sé si mi mascota tiene fiebre?",
  "¿Es normal que mi gato vomite pelo?",
  "¿Qué debo hacer si mi perro se intoxica?",
  "¿Cómo cuidar a un cachorro recién adoptado?",
  "¿Qué alimentos son peligrosos para los perros?",
  "¿Cómo limpiar los oídos de mi gato?",
  "¿Por qué mi perro se rasca mucho?",
  "¿Cuándo debo esterilizar a mi mascota?",
  "¿Cómo prevenir pulgas y garrapatas?"
];

/* =======================
   Utilidades de imagen
======================= */
function clearPendingImage() {
  if (pendingImageURL) {
    URL.revokeObjectURL(pendingImageURL);
    pendingImageURL = null;
  }
  pendingImageFile = null;
  imageInput.value = "";

  if (chip) chip.style.display = "none";
  if (chipThumb) chipThumb.src = "";
  if (chipName) chipName.textContent = "";

  if (imageModePreview) {
    imageModePreview.src = "";
    imageModePreview.style.display = "none";
  }
  if (imageModeDrop) imageModeDrop.classList.remove("has-file");
}

function enterImageRequestMode({ title, reason }) {
  imageRequestActive = true;

  // UI
  userInput.style.display = "none";
  sendBtn.style.display = "none";
  attachBtn.style.display = ""; // si quieres ocultarlo también en modo imagen, pon "none"

  const sug = document.getElementById("chatbot-suggestions");
  if (sug) sug.style.display = "none";

  if (imageModeCard) {
    imageModeTitle.textContent = title || "¿Puedes compartir una foto?";
    imageModeReason.textContent = reason || "Necesito ver mejor la zona afectada.";
    imageModeCard.style.display = "flex";
  }

  container?.classList.add("image-mode-active");
  clearPendingImage();
}

function exitImageRequestMode() {
  imageRequestActive = false;

  if (imageModeCard) {
  imageModeCard.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (imageModeSend && !imageModeSend.disabled) {
        imageModeSend.click();
      }
    }
  });
}
}

/* =======================
   Formato de respuesta bot
======================= */
function formatBotResponse(input) {
  let text = String(input ?? "");

  // Encabezados
  text = text.replace(/^#\s(.+)/gm, '<h3 class="bot-response-title">$1</h3>');
  text = text.replace(/^##\s(.+)/gm, '<h4 class="bot-response-subtitle">$1</h4>');

  // Listas numeradas
  text = text.replace(/^(\d+)\.\s(.+)/gm, '<li class="bot-list-item"><span class="bot-number">$1.</span> $2</li>');

  // Viñetas
  text = text.replace(/^-\s(.+)/gm, '<li class="bot-list-item">$1</li>');
  text = text.replace(/^\*\s(.+)/gm, '<li class="bot-list-item">$1</li>');

  // Agrupar listas consecutivas
  text = text.replace(/(<li class="bot-list-item">.+<\/li>)+/g, (match) => `<ul class="bot-list">${match}</ul>`);

  // Negritas y cursivas
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong class="bot-strong">$1</strong>');
  text = text.replace(/\*(.+?)\*/g, '<em class="bot-em">$1</em>');

  // Notas
  text = text.replace(/!!(.+?)!!/g, '<div class="bot-note"><i class="fas fa-exclamation-circle"></i> $1</div>');

  // Tips
  text = text.replace(/\?\?(.+?)\?\?/g, '<div class="bot-tip"><i class="fas fa-lightbulb"></i> $1</div>');

  // Emergencias
  text = text.replace(/!EMERGENCIA!(.+?)!/g, '<div class="bot-emergency"><i class="fas fa-ambulance"></i> $1</div>');

  // Saltos de línea
  text = text.replace(/\n/g, "<br>");

  return text;
}

/* =======================
   Chat UI / Firestore
======================= */
function addMessage(message, sender, type = "text") {
  const msgDiv = document.createElement("div");
  msgDiv.classList.add("chat-message", sender === "bot" ? "bot-message" : "user-message");

  if (type === "image") {
    msgDiv.innerHTML = message; // trae <img>
  } else {
    if (sender === "bot" && typeof message !== "string") {
      console.warn("Bot recibió no-string en addMessage:", message);
    }
    msgDiv.innerHTML = sender === "bot" ? formatBotResponse(message) : `<p>${message}</p>`;
  }

  messagesContainer.appendChild(msgDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function saveMessage(message, sender, type = "text", imageUrl = null) {
  const messageData = { sender, type, timestamp: serverTimestamp() };
  if (type === "image") messageData.imageUrl = imageUrl;
  else messageData.message = message;

  addDoc(collection(window.db, "chatVetScanIa"), messageData);
}

function loadMessages() {
  const q = query(collection(window.db, "chatVetScanIa"), orderBy("timestamp"));
  onSnapshot(q, (snapshot) => {
    messagesContainer.innerHTML = "";

    if (snapshot.empty) {
      addMessage("¡Hola! Soy el asistente virtual de VetScanIa. ¿En qué puedo ayudarte hoy con tu mascota?", "bot");
      return;
    }

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.type === "image") {
        addMessage(`<img src="${data.imageUrl}" class="chat-img">`, data.sender, "image");
      } else {
        addMessage(data.message, data.sender);
      }
    });
  });
}

/* =======================
   Backend
======================= */
async function getAIResponse(message) {
  try {
    const res = await fetch("https://us-central1-vetscania-e36b4.cloudfunctions.net/chatWithAI", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Para pruebas, fuerza sesión nueva; luego usa un UUID estable
      body: JSON.stringify({ message, sessionId: "current-session-" + Date.now() })
    });
    const data = await res.json();
    const reply = data.reply || "";

    // A) Con etiquetas <REQUEST_IMAGE>...</REQUEST_IMAGE>
    const TAG_RX = /<REQUEST_IMAGE>([\s\S]*?)<\/REQUEST_IMAGE>/;
    const tagMatch = reply.match(TAG_RX);
    if (tagMatch) {
      const block = tagMatch[1];
      const title  = (block.match(/title:\s*"(.*?)"/)  || [])[1] || "¿Puedes compartir una foto?";
      const reason = (block.match(/reason:\s*"(.*?)"/) || [])[1] || "Necesito ver mejor la zona afectada.";
      const preface = reply.replace(TAG_RX, "").trim();
      return { type: "request_image", title, reason, preface };
    }

    // B) Sin etiquetas: 4 líneas tipo YAML (title/reason/instructions/tips)
    const RAW_RX = /(^|\n)\s*title:\s*"(.*?)"\s*\n\s*reason:\s*"(.*?)"\s*\n\s*instructions:\s*"(.*?)"\s*\n\s*tips:\s*"(.*?)"/i;
    const rawMatch = reply.match(RAW_RX);
    if (rawMatch) {
      const title  = rawMatch[2] || "¿Puedes compartir una foto?";
      const reason = rawMatch[3] || "Necesito ver mejor la zona afectada.";
      const preface = reply.replace(RAW_RX, "").trim();
      return { type: "request_image", title, reason, preface };
    }

    // C) Texto normal
    return { type: "text", reply };
  } catch (error) {
    console.error("Error al obtener respuesta:", error);
    return { type: "text", reply: "Lo siento, ocurrió un error al procesar tu pregunta. Por favor intenta nuevamente." };
  }
}

/* =======================
   Sugerencias
======================= */
function mostrarPreguntasAleatorias() {
  const contenedor = document.getElementById("suggestion-buttons");
  contenedor.innerHTML = "";

  const preguntasMezcladas = [...preguntasFrecuentes].sort(() => 0.5 - Math.random()).slice(0, 3);

  preguntasMezcladas.forEach((pregunta) => {
    const boton = document.createElement("button");
    boton.className = "suggestion-btn";
    boton.textContent = pregunta;
    boton.addEventListener("click", () => {
      document.getElementById("user-input").value = pregunta;
      ocultarSugerencias();
    });
    contenedor.appendChild(boton);
  });

  mostrarSugerencias();
}

function mostrarSugerencias() {
  document.getElementById("chatbot-suggestions").style.display = "block";
}
function ocultarSugerencias() {
  document.getElementById("chatbot-suggestions").style.display = "none";
}

/* =======================
   Eventos de imagen
======================= */
// Oculta clip por defecto (lo muestra modo imagen si quieres)
attachBtn.style.display = "none";

// Click en clip → abrir file dialog
attachBtn.addEventListener("click", () => imageInput.click());

// Selección desde file dialog
imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (!file) return;

  if (pendingImageURL) {
    URL.revokeObjectURL(pendingImageURL);
    pendingImageURL = null;
  }

  pendingImageFile = file;
  pendingImageURL = URL.createObjectURL(file);

  if (imageRequestActive) {
    // Modo imagen → preview en la card
    if (imageModePreview) {
      imageModePreview.src = pendingImageURL;
      imageModePreview.style.display = "block";
    }
    if (imageModeDrop) imageModeDrop.classList.add("has-file");
  } else {
    // Modo normal → chip
    if (chipThumb) chipThumb.src = pendingImageURL;
    if (chipName) chipName.textContent = file.name;
    if (chip) chip.style.display = "flex";
  }
});

// Quitar adjunto (chip)
chipRemove?.addEventListener("click", () => {
  clearPendingImage();
});

// Dropzone (modo imagen)
if (imageModeDrop) {
  ["dragenter","dragover"].forEach(ev => {
    imageModeDrop.addEventListener(ev, e => { e.preventDefault(); imageModeDrop.classList.add("drag"); });
  });
  ["dragleave","drop"].forEach(ev => {
    imageModeDrop.addEventListener(ev, e => { e.preventDefault(); imageModeDrop.classList.remove("drag"); });
  });
  imageModeDrop.addEventListener("drop", e => {
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      if (pendingImageURL) URL.revokeObjectURL(pendingImageURL);
      pendingImageFile = file;
      pendingImageURL = URL.createObjectURL(file);
      if (imageModePreview) {
        imageModePreview.src = pendingImageURL;
        imageModePreview.style.display = "block";
      }
      imageModeDrop.classList.add("has-file");
    }
  });
  imageModeDrop.addEventListener("click", () => imageInput.click());
}

// Botón "Enviar foto" (modo imagen)
imageModeSend?.addEventListener("click", async () => {
  if (!pendingImageFile) return;

  try {
    // Sube imagen
    const imgRef = ref(storage, `chatVetScanIa/${Date.now()}_${pendingImageFile.name}`);
    await uploadBytes(imgRef, pendingImageFile);
    const url = await getDownloadURL(imgRef);

    // Muestra y guarda en chat
    addMessage(`<img src="${url}" class="chat-img">`, "user", "image");
    await saveMessage("", "user", "image", url);

    // Envía al backend para análisis
    const follow = await getAIResponse(`IMAGE_URL: ${url}`);

    exitImageRequestMode();

    if (follow.type === "text") {
      addMessage(follow.reply, "bot");
      saveMessage(follow.reply, "bot");
    } else if (follow.type === "request_image") {
      if (follow.preface) {
        addMessage(follow.preface, "bot");
        saveMessage(follow.preface, "bot");
      }
      addMessage(`📷 ${follow.title}<br><small>${follow.reason}</small>`, "bot");
      saveMessage(`${follow.title} — ${follow.reason}`, "bot");
      enterImageRequestMode(follow);
    }
  } catch (err) {
    console.error("Error al subir/analizar imagen:", err);
    addMessage("No pude subir o analizar la imagen. Intenta de nuevo.", "bot");
  } finally {
    clearPendingImage();
  }
});

// Botón "Cancelar" (modo imagen)
imageModeCancel?.addEventListener("click", () => {
  exitImageRequestMode();
});

/* =======================
   Envío (texto + imagen opcional)
======================= */
document.getElementById("close-suggestions")?.addEventListener("click", ocultarSugerencias);

sendBtn.addEventListener("click", async () => {
  const text = userInput.value.trim();

  // Nada que enviar
  if (!text && !pendingImageFile) return;

  // 1) Texto (si hay)
  if (text) {
    addMessage(text, "user");
    saveMessage(text, "user");
    userInput.value = "";
  }

  // 2) Imagen (si hay) — flujo de modo normal
  if (pendingImageFile && !imageRequestActive) {
    try {
      const imgRef = ref(storage, `chatVetScanIa/${Date.now()}_${pendingImageFile.name}`);
      await uploadBytes(imgRef, pendingImageFile);
      const url = await getDownloadURL(imgRef);

      await saveMessage("", "user", "image", url);
      addMessage(`<img src="${url}" class="chat-img">`, "user", "image");

      if (ANALYZE_IMAGES_IN_NORMAL_MODE) {
        const follow = await getAIResponse(`IMAGE_URL: ${url}`);
        if (follow.type === "text") {
          addMessage(follow.reply, "bot");
          saveMessage(follow.reply, "bot");
        } else {
          if (follow.preface) { addMessage(follow.preface, "bot"); saveMessage(follow.preface, "bot"); }
          addMessage(`📷 ${follow.title}<br><small>${follow.reason}</small>`, "bot");
          saveMessage(`${follow.title} — ${follow.reason}`, "bot");
          enterImageRequestMode(follow);
        }
      }
    } catch (err) {
      console.error("Error al subir la imagen:", err);
      addMessage("Error al subir la imagen. Por favor intenta nuevamente.", "bot");
    } finally {
      clearPendingImage();
    }
  }

  // 3) Respuesta de la IA SOLO si hubo texto en este envío
  if (text) {
    const result = await getAIResponse(text);

    if (result.type === "text") {
      addMessage(result.reply, "bot");
      saveMessage(result.reply, "bot");
    } else if (result.type === "request_image") {
      if (result.preface) {
        addMessage(result.preface, "bot");
        saveMessage(result.preface, "bot");
      }
      addMessage(`📷 ${result.title}<br><small>${result.reason}</small>`, "bot");
      saveMessage(`${result.title} — ${result.reason}`, "bot");
      enterImageRequestMode(result);
    }
  }
});

// Enter para enviar
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendBtn.click();
});

// Sugerencias
suggestionBtns.forEach((btn) => {
  btn.addEventListener("click", async () => {
    const question = btn.textContent;
    addMessage(question, "user");
    saveMessage(question, "user");

    const result = await getAIResponse(question);

    if (result.type === "text") {
      addMessage(result.reply, "bot");
      saveMessage(result.reply, "bot");
    } else if (result.type === "request_image") {
      if (result.preface) {
        addMessage(result.preface, "bot");
        saveMessage(result.preface, "bot");
      }
      addMessage(`📷 ${result.title}<br><small>${result.reason}</small>`, "bot");
      saveMessage(`${result.title} — ${result.reason}`, "bot");
      enterImageRequestMode(result);
    }
  });
});

// Mostrar/ocultar sugerencias según input
document.getElementById("user-input")?.addEventListener("input", function () {
  document.getElementById("chatbot-suggestions").style.display = this.value.trim().length > 0 ? "none" : "block";
});

// Dropzone clic (por si no hay clip)
if (imageModeDrop) {
  imageModeDrop.addEventListener("click", () => imageInput.click());
}

/* =======================
   Init
======================= */
document.addEventListener('DOMContentLoaded', function () {
  mostrarPreguntasAleatorias();             // ⬅️ siempre genera FAQ al inicio
  const sug = document.getElementById('chatbot-suggestions');
  if (sug) sug.style.display = "block";     // ⬅️ visible de inicio
  loadMessages();
});


// (Opcional) expón funciones
window.enterImageRequestMode = enterImageRequestMode;
window.exitImageRequestMode  = exitImageRequestMode;
window.clearPendingImage     = clearPendingImage;
