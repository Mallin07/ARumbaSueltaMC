// functions/index.js — Versión v2 (Gen2) compatible con Node 22
const { setGlobalOptions } = require("firebase-functions/v2"); // v2 core
const { onDocumentCreated } = require("firebase-functions/v2/firestore"); // trigger v2
const admin = require("firebase-admin");

setGlobalOptions({
  region: "us-central1",   // usa la misma región que elegiste al instalar la extensión
  maxInstances: 10
});

admin.initializeApp();

exports.notifyNewRoute = onDocumentCreated("routes/{routeId}", async (event) => {
  const snap = event.data;
  if (!snap) return;

  const route = snap.data();

  // Obtiene usuarios
  const usersSnap = await admin.firestore().collection("users").get();
  if (usersSnap.empty) return;

  // Prepara lote de /mail (Trigger Email leerá estos docs)
  const batch = admin.firestore().batch();

  usersSnap.forEach((doc) => {
    const u = doc.data();
    if (!u?.email) return;

    const mailRef = admin.firestore().collection("mail").doc();
    batch.set(mailRef, {
      to: u.email,
      message: {
        subject: `Nueva ruta: ${route.name || "Ruta"}`,
        text: `Se ha creado una nueva ruta para el ${route.date || ""} a las ${route.time || ""}.`,
        html: `
          <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;line-height:1.5">
            <h2>Nueva ruta</h2>
            <p><strong>${route.name || "Ruta"}</strong></p>
            <p>📅 ${route.date || ""} · ⏱️ ${route.time || ""}${route.arrivalTime ? " — " + route.arrivalTime : ""}</p>
            <p>🚩 ${route.start?.name || "Salida"} · 🏁 ${route.endPoint || ""}${route.distanceKm ? " · " + route.distanceKm + " km" : ""}</p>
            ${route.routeLink ? `<p>🗺️ <a href="${route.routeLink}">Ver ruta en Google Maps</a></p>` : ""}
          </div>
        `
      }
    });
  });

  await batch.commit();
});
