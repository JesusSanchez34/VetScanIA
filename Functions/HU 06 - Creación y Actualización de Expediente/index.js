// index.js (Functions v2, 2nd Gen - con CORS FIX)
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { setGlobalOptions } = require("firebase-functions/v2");
const OpenAI = require("openai");

// ░░░ OPCIONES GLOBALES ░░░
setGlobalOptions({
  region: "us-central1",
  memory: "512MiB",
  timeoutSeconds: 60,
  maxInstances: 3,
});

const BUILD = "v2-image-protocol-2025-09-30c";

// ░░░ SECRET (OpenAI) ░░░
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

// ░░░ CONTEXTO EN MEMORIA ░░░
const sessionContexts = new Map();

// ░░░ FUNCIÓN PRINCIPAL ░░░
// ⚠️ Importante: NO manejar OPTIONS manualmente, cors lo hace solo
exports.chatWithAI = onRequest(
  {
    cors: ["http://127.0.0.1:5500", "http://localhost:5500"],
    secrets: [OPENAI_API_KEY],
  },
  async (req, res) => {
    try {
      const { message, sessionId = "anon-session" } = req.body || {};
      if (!message || typeof message !== "string") {
        res.set("Vary", "Origin");
        res.status(400).json({
          reply: "Por favor envía un mensaje válido para poder ayudarte.",
          suggestion: "Describe los síntomas de tu mascota con detalles.",
          build: BUILD,
        });
        return;
      }

      // ░░░ CONTEXTO NUEVO ░░░
      if (!sessionContexts.has(sessionId)) {
        sessionContexts.set(sessionId, [
          {
            role: "system",
            content: `
Eres VetScanIA, un asistente veterinario especializado. Sigue estrictamente estas reglas:

1. **Protocolo de diagnóstico**:
   a) Pide siempre: especie (perro/gato/ave), edad, raza, síntomas específicos y duración.
   b) Para síntomas graves (convulsiones, sangrado, dificultad respiratoria):
      "🚨 EMERGENCIA: Acude inmediatamente al veterinario más cercano. Motivo: [explicación breve]"
   c) Para casos no urgentes: ofrece consejos prácticos y señales de alerta.

2. **Límites profesionales**:
   - Nunca des diagnósticos definitivos sin examen físico.
   - En casos dudosos, recomienda consulta veterinaria.
   - Para remedios caseros, indica claramente cuándo deben suspenderse.

3. **Estilo de comunicación**:
   - Lenguaje claro y empático (usa emojis con moderación 🐾).
   - Organiza la información en puntos clave.
   - Pide confirmación antes de dar recomendaciones.

4. **Solicitud de imágenes (protocolo UI)**:
   - Cuando NECESITES ver una foto (herida, piel, pelaje, vómito, heces, lesiones en ojos/orejas, etc.),
     responde **ÚNICAMENTE** con este bloque, sin texto adicional:
     <REQUEST_IMAGE>
     title: "¿Puedes compartir una foto?"
     reason: "Necesito evaluar [qué y por qué]."
     instructions: "Toma 2-3 fotos: 1) plano general, 2) acercamiento ~10-15 cm, 3) buena luz y enfoque."
     tips: "Evita filtros, limpia suavemente si hay sangre, no uses flash directo."
     </REQUEST_IMAGE>
   - Cuando recibas un mensaje del usuario con el formato exacto:
     IMAGE_URL: https://...
     trátalo como la foto adjunta y:
       1) describe lo que observas con cautela (puedes equivocarte),
       2) explica posibles causas diferenciales,
       3) da recomendaciones de primeros auxilios/observación,
       4) lista banderas rojas para acudir al veterinario,
       5) si la calidad no es suficiente, vuelve a pedir foto con el mismo bloque.

Ejemplo de flujo ideal:
Usuario: "Mi perro vomitó"
Tú: "Entiendo, ¿podrías decirme:
    1. ¿Qué edad y raza tiene tu perro?
    2. ¿Qué aspecto tenía el vómito (color, consistencia)?
    3. ¿Cuántas veces ha vomitado en las últimas 24 horas?"
`
          }
        ]);
      }

      const context = sessionContexts.get(sessionId);

      // ░░░ CLIENTE OPENAI ░░░
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // ░░░ ¿HAY IMAGEN? ░░░
      const imgMatch = String(message).trim().match(/^IMAGE_URL:\s*(https?:\/\/\S+)/i);
      if (imgMatch) {
        const url = imgMatch[1];
        context.push({
          role: "user",
          content: [
            {
              type: "text",
              text: "Imagen enviada por el usuario para evaluación veterinaria. Analízala en español con el contexto previo.",
            },
            { type: "image_url", image_url: { url } },
          ],
        });
      } else {
        context.push({ role: "user", content: message });
      }

      // ░░░ LLAMADA AL MODELO ░░░
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: context,
        temperature: 0.5,
        max_tokens: 500,
      });

      const reply = completion?.choices?.[0]?.message?.content || "";

      if (!reply) {
        res.set("Vary", "Origin");
        res.json({
          reply: "No pude procesar tu consulta en este momento. Por favor intenta nuevamente.",
          emergencyAdvice: "Si es una emergencia, acude inmediatamente al veterinario.",
          build: BUILD,
        });
        return;
      }

      context.push({ role: "assistant", content: reply });
      sessionContexts.set(sessionId, context);

      res.set("Vary", "Origin");
      res.json({ reply, build: BUILD });
    } catch (err) {
      console.error("💥 ERROR en chatWithAI:", err);
      res.set("Vary", "Origin");
      res.status(500).json({
        reply: "Ocurrió un error al procesar tu consulta.",
        emergencyProtocol: "Si tu mascota presenta síntomas graves, no esperes y acude al veterinario inmediatamente.",
        retrySuggestion: "Puedes intentar nuevamente en unos minutos.",
        build: BUILD,
      });
    }
  }
);



/** ==============================
 *  JESÚS — HU-03 Captura de Imagen para Análisis
 *  Endpoint: POST /analyzeImage
 *  Body: { imageUrl: string, petId?: string, userId?: string }
 *  Acción: valida URL, construye prompt de análisis y guarda resultado preliminar en Firestore.
 *  Nota: El llamado a OpenAI está marcado como TODO para inyectar API Key via Secret.
 * ===============================*/
const { onRequest } = require("firebase-functions/v2/https");
const { HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");

exports.analyzeImage = onRequest(async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
  try {
    const { imageUrl, petId = null, userId = null } = req.body || {};
    if (!imageUrl || typeof imageUrl !== "string") {
      return res.status(400).json({ error: "imageUrl requerido" });
    }

    // Validación simple de extensión/mime por URL
    const validExt = /\.(png|jpg|jpeg|webp|avif)$/i.test(imageUrl);
    if (!validExt) {
      return res.status(400).json({ error: "Formato de imagen no soportado" });
    }

    // Construcción de prompt (borrador)
    const prompt = [
      "Eres un asistente veterinario. Analiza la imagen de una mascota para señales visibles de riesgo.",
      "Devuelve JSON con: { riesgo: 'bajo|medio|alto', hallazgos: string[], recomendaciones: string[] }",
      `Imagen: ${imageUrl}`
    ].join("\\n");

    // TODO: Integración con OpenAI (gpt-vision). Aquí se simula respuesta.
    const simulated = {
      riesgo: "medio",
      hallazgos: ["ojos enrojecidos", "posible dermatitis en oreja izquierda"],
      recomendaciones: ["limpieza ocular", "revisar con veterinario si persiste comezón"]
    };

    const db = getFirestore();
    const ref = await db.collection("analisisImagen").add({
      imageUrl, petId, userId,
      resultado: simulated,
      createdAt: new Date()
    });

    return res.json({ ok: true, id: ref.id, resultado: simulated, promptUsado: prompt.slice(0, 140) + "..." });
  } catch (e) {
    console.error("analyzeImage error", e);
    return res.status(500).json({ error: "internal", details: String(e) });
  }
});



/** ==============================
 *  SAÚL — HU-09 Monitoreo de Sensores (IoT)
 *  Endpoint: POST /ingestTelemetry
 *  Body: { sensorId: string, temp?: number, hum?: number, bpm?: number, ts?: number }
 *  Acción: valida payload, guarda telemetría en subcolección y actualiza estado del sensor.
 * ===============================*/
const { onRequest: onRequestIoT } = require("firebase-functions/v2/https");
const { getFirestore: getDb } = require("firebase-admin/firestore");

exports.ingestTelemetry = onRequestIoT(async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
  try {
    const { sensorId, temp = null, hum = null, bpm = null, ts = Date.now() } = req.body || {};
    if (!sensorId) return res.status(400).json({ error: "sensorId requerido" });

    const db = getDb();
    const sensorRef = db.collection("sensors").doc(String(sensorId));
    const teleRef = sensorRef.collection("telemetry").doc();
    const payload = {
      temp, hum, bpm,
      ts: new Date(typeof ts === "number" ? ts : Date.now())
    };

    await teleRef.set(payload);
    await sensorRef.set({
      lastTelemetry: payload,
      updatedAt: new Date()
    }, { merge: true });

    return res.json({ ok: true, id: teleRef.id });
  } catch (e) {
    console.error("ingestTelemetry error", e);
    return res.status(500).json({ error: "internal", details: String(e) });
  }
});


/** ===============================
 * JESÚS — HU-06 Actualización de expediente
 * nota: apenas estoy probando esta parte
 * =============================== */
exports.updatePetProfile = onRequest(async (req, res) => {
  // checar metodo, solo debe ser PATCH
  if (req.method !== "PATCH") return res.status(405).json({ error: "usa PATCH" });

  const { petId, data } = req.body || {};

  // validar basico
  if (!petId || !data) {
    return res.status(400).json({ error: "faltan datos" });
  }

  try {
    const db = getFirestore();
    const petRef = db.collection("pets").doc(petId);

    // luego agrego validacion del user q hace el cambio
    await petRef.set(
      {
        ...data,
        updatedAt: new Date(),
      },
      { merge: true }
    );

    // simulo respuesta, falta log de cambios
    return res.json({
      ok: true,
      msg: "expediente actualizado (falta revisar permisos)",
    });
  } catch (e) {
    console.log("updatePetProfile err", e);
    return res.status(500).json({ error: "error interno" });
  }
});
