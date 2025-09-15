// login.js (usar como módulo ES)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ⚠️ Tu config Firebase
const firebaseConfig = {
  apiKey: "AIzaSyASxL2FjzUdP0Lm5pzfV5xmA1nywPMWdjw",
  authDomain: "arsmc-873f3.firebaseapp.com",
  projectId: "arsmc-873f3",
  storageBucket: "arsmc-873f3.appspot.com",
  messagingSenderId: "558517245585",
  appId: "1:558517245585:web:9816b346b67c4d7cb69130",
  measurementId: "G-8WGXBDMSVZ"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ✅ Muy importante: NO redirigir aquí por onAuthStateChanged.
// En su lugar, al abrir index.html, cerramos sesión para obligar a loguear.
(async () => {
  try {
    // Garantiza que la sesión se guarda mientras navegas,
    // pero se limpia explícitamente al aterrizar en index.html
    await setPersistence(auth, browserLocalPersistence);
    await signOut(auth); // fuerza logout si venías con sesión
  } catch (e) {
    // Ignoramos cualquier error de signOut/setPersistence
    console.debug("No se pudo cerrar sesión al cargar login:", e);
  }
})();

const form = document.getElementById('loginForm');
const emailEl = document.getElementById('loginEmail');
const passEl = document.getElementById('loginPassword');
const btn = document.getElementById('loginBtn');
const err = document.getElementById('loginError');
const resetBtn = document.getElementById('resetBtn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  err.style.color = "#ff6b6b";
  err.textContent = "";
  btn.disabled = true;

  try {
    await signInWithEmailAndPassword(auth, emailEl.value.trim(), passEl.value);
    // ✅ Redirige explícitamente al área privada tras login
    window.location.href = "principal/principal.html";
  } catch (e) {
    const map = {
      "auth/invalid-email": "Correo no válido.",
      "auth/user-not-found": "Usuario no encontrado.",
      "auth/wrong-password": "Contraseña incorrecta.",
      "auth/too-many-requests": "Demasiados intentos. Intenta más tarde."
    };
    err.textContent = map[e.code] || "No se pudo iniciar sesión.";
  } finally {
    btn.disabled = false;
  }
});

resetBtn.addEventListener('click', async () => {
  err.textContent = "";
  err.style.color = "#ff6b6b";
  if (!emailEl.value) {
    err.textContent = "Escribe tu correo arriba y pulsa recuperar.";
    return;
  }
  try {
    await sendPasswordResetEmail(auth, emailEl.value.trim());
    err.style.color = "#8fffb0";
    err.textContent = "Correo de recuperación enviado.";
  } catch (e) {
    err.style.color = "#ff6b6b";
    err.textContent = "No se pudo enviar el correo de recuperación.";
  }
});

// npm i firebase-admin firebase-functions
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

const COUNTER_REF = db.doc("meta/memberCounter");

// Helpers
async function getNextNumberByTx(tx) {
  const snap = await tx.get(COUNTER_REF);
  const current = snap.exists ? (snap.data().value || 0) : 0;
  const next = current + 1;
  // guarda el nuevo valor del contador
  if (snap.exists) tx.update(COUNTER_REF, { value: next });
  else tx.set(COUNTER_REF, { value: next });
  return next;
}

// Asignar número al crear doc de usuario
exports.assignMemberNumber = functions.firestore
  .document("users/{uid}")
  .onCreate(async (snap, ctx) => {
    await db.runTransaction(async (tx) => {
      const next = await getNextNumberByTx(tx);
      tx.update(snap.ref, { memberNumber: next }); // guarda solo el número (int)
    });
  });

// Compactar al borrar: todo > eliminado baja 1 y decrementa el contador
exports.compactNumbersOnDelete = functions.firestore
  .document("users/{uid}")
  .onDelete(async (snap, ctx) => {
    const removed = snap.data()?.memberNumber;
    if (!removed) return;

    // 1) Shift: todos los usuarios con número > removed bajan 1
    const q = db.collection("users")
      .where("memberNumber", ">", removed)
      .orderBy("memberNumber");
    const all = await q.get();

    // batched writes (máx. 500 por batch)
    let batch = db.batch();
    let count = 0;
    for (const doc of all.docs) {
      batch.update(doc.ref, { memberNumber: (doc.get("memberNumber") || 0) - 1 });
      count++;
      if (count === 400) { await batch.commit(); batch = db.batch(); count = 0; }
    }
    if (count) await batch.commit();

    // 2) Ajusta el contador global (-1)
    await COUNTER_REF.set(
      { value: admin.firestore.FieldValue.increment(-1) },
      { merge: true }
    );
  });