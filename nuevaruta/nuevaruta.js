// nuevaruta.js (ES module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 🔑 tu config
const firebaseConfig = {
  apiKey: "AIzaSyASxL2FjzUdP0Lm5pzfV5xmA1nywPMWdjw",
  authDomain: "arsmc-873f3.firebaseapp.com",
  projectId: "arsmc-873f3",
  storageBucket: "arsmc-873f3.appspot.com",
  messagingSenderId: "558517245585",
  appId: "1:558517245585:web:9816b346b67c4d7cb69130",
  measurementId: "G-8WGXBDMSVZ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --------- UI refs ----------
const form = document.getElementById('routeForm');
const routeNameEl = document.getElementById('routeName');
const routeDateEl = document.getElementById('routeDate');
const routeTimeEl = document.getElementById('routeTime');
const startLinkEl = document.getElementById('startLink');
const stopsListEl = document.getElementById('stopsList');
const addStopBtn = document.getElementById('addStopBtn');
const endPointEl = document.getElementById('endPoint');
const routeLinkEl = document.getElementById('routeLink');
const formError = document.getElementById('formError');
const cancelBtn = document.getElementById('cancelBtn');

// NUEVO: comidas y velocidad
const breakfastEl = document.getElementById('breakfast');
const lunchEl = document.getElementById('lunch');

// --------- auth guard ----------
onAuthStateChanged(auth, (user) => {
  if (!user) window.location.href = "../index.html";
});

// --------- helpers ----------
function isGoogleMapsUrl(url) {
  try {
    const u = new URL(url.trim());
    const h = u.host.toLowerCase();
    const p = u.pathname;
    // google.<tld>/maps..., goo.gl/maps..., g.co/maps..., maps.app.goo.gl/...
    const isGoogleHost = /(^|\.)google\.[a-z.]+$/.test(h) && (p.startsWith("/maps") || u.searchParams.has("q"));
    const isShort = (h === "goo.gl" || h === "g.co") && p.startsWith("/maps");
    const isApp = h === "maps.app.goo.gl"; // cualquier path
    return isGoogleHost || isShort || isApp;
  } catch { return false; }
}

function addStopInput(value = "") {
  const row = document.createElement('div');
  row.className = 'stop-row';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Nombre de la parada';
  input.value = value;

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'icon-btn';
  del.title = 'Eliminar';
  del.innerHTML = '✕';
  del.addEventListener('click', () => row.remove());

  row.appendChild(input);
  row.appendChild(del);
  stopsListEl.appendChild(row);
}

// añade una primera fila de parada vacía por ergonomía
addStopInput();
addStopBtn.addEventListener('click', () => addStopInput());

// --------- submit ----------
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.textContent = '';

  // Validaciones mínimas
  if (!routeNameEl.value.trim()) return (formError.textContent = 'Pon un nombre a la ruta.');
  if (!routeDateEl.value) return (formError.textContent = 'Selecciona una fecha.');
  if (!routeTimeEl.value) return (formError.textContent = 'Indica la hora de salida.');
  if (!startLinkEl.value || !isGoogleMapsUrl(startLinkEl.value)) {
    return (formError.textContent = 'El punto de salida debe ser un enlace válido de Google Maps.');
  }
  if (!endPointEl.value.trim()) return (formError.textContent = 'Indica el punto de llegada.');
  if (!routeLinkEl.value || !isGoogleMapsUrl(routeLinkEl.value)) {
    return (formError.textContent = 'El enlace de la ruta debe ser un enlace válido de Google Maps.');
  }

  // NUEVO: velocidad seleccionada
  const speed = form.querySelector('input[name="speed"]:checked')?.value;
  if (!speed) return (formError.textContent = 'Selecciona la velocidad.');

  // NUEVO: comidas
  if (!breakfastEl?.value) return (formError.textContent = 'Selecciona el desayuno.');
  if (!lunchEl?.value) return (formError.textContent = 'Selecciona la comida.');

  // Paradas (no vacías)
  const stops = Array.from(stopsListEl.querySelectorAll('input[type="text"]'))
    .map(i => i.value.trim())
    .filter(Boolean);

  const user = auth.currentUser;
  if (!user) return (formError.textContent = "Inicia sesión.");

  const payload = {
    name: routeNameEl.value.trim(),
    date: routeDateEl.value,                 // YYYY-MM-DD
    time: routeTimeEl.value,                 // HH:MM
    startLink: startLinkEl.value.trim(),
    stops,                                   // array<string>
    endPoint: endPointEl.value.trim(),
    routeLink: routeLinkEl.value.trim(),

    // NUEVO:
    speed,                                   // 'chill' | 'alegre' | 'album'
    meals: {
      breakfast: breakfastEl.value,          // 'casa' | 'bocata' | 'restaurante'
      lunch: lunchEl.value
    },

    createdBy: user.uid,
    createdAt: serverTimestamp(),
    status: "draft"
  };

  try {
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    await addDoc(collection(db, "routes"), payload);

    alert("Ruta guardada correctamente.");
    window.location.href = "rutas.html";
  } catch (err) {
    console.error("Error guardando ruta:", err);
    form.querySelector('button[type="submit"]').disabled = false;
    formError.textContent = "No se pudo guardar la ruta. Revisa la consola y las reglas.";
  }
});

cancelBtn.addEventListener('click', () => {
  if (confirm("¿Descartar cambios?")) window.location.href = "rutas.html";
});
