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
const arrivalTimeEl = document.getElementById('arrivalTime');   // opcional

// Salida: nombre + link
const startNameEl = document.getElementById('startName');
const startLinkEl = document.getElementById('startLink');

const distanceKmEl = document.getElementById('distanceKm');     // opcional
const endPointEl = document.getElementById('endPoint');
const routeLinkEl = document.getElementById('routeLink');       // opcional
const formError = document.getElementById('formError');
const cancelBtn = document.getElementById('cancelBtn');

// comidas / velocidad
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
    const isGoogleHost = /(^|\.)google\.[a-z.]+$/.test(h) && (p.startsWith("/maps") || u.searchParams.has("q"));
    const isShort = (h === "goo.gl" || h === "g.co") && p.startsWith("/maps");
    const isApp = h === "maps.app.goo.gl";
    return isGoogleHost || isShort || isApp;
  } catch { return false; }
}

function toDateTime(dateStr, timeStr) {
  const [y,m,d] = dateStr.split('-').map(Number);
  const [hh,mm] = timeStr.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

// --------- submit ----------
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.textContent = '';

  // Validaciones obligatorias
  if (!routeNameEl.value.trim()) return (formError.textContent = 'Pon un nombre a la ruta.');
  if (!routeDateEl.value) return (formError.textContent = 'Selecciona una fecha.');
  if (!routeTimeEl.value) return (formError.textContent = 'Indica la hora de salida.');
  if (!startNameEl.value.trim()) return (formError.textContent = 'Indica el nombre del punto de salida.');
  if (!startLinkEl.value || !isGoogleMapsUrl(startLinkEl.value)) {
    return (formError.textContent = 'El enlace del punto de salida debe ser válido de Google Maps.');
  }
  if (!endPointEl.value.trim()) return (formError.textContent = 'Indica el punto de llegada.');

  // Opcionales con validación condicional
  // llegada: si existe, no puede ser anterior a la salida (mismo día)
  if (arrivalTimeEl.value) {
    const dep = toDateTime(routeDateEl.value, routeTimeEl.value);
    const arr = toDateTime(routeDateEl.value, arrivalTimeEl.value);
    if (arr < dep) return (formError.textContent = 'La hora de llegada no puede ser anterior a la hora de salida.');
  }

  // distancia: si existe, debe ser > 0
  if (distanceKmEl.value) {
    const distance = Number(distanceKmEl.value);
    if (!Number.isFinite(distance) || distance <= 0) {
      return (formError.textContent = 'Indica una distancia válida en kilómetros (mayor que 0).');
    }
  }

  // routeLink: si existe, debe ser Google Maps válido
  if (routeLinkEl.value && !isGoogleMapsUrl(routeLinkEl.value)) {
    return (formError.textContent = 'El enlace de la ruta debe ser un enlace válido de Google Maps.');
  }

  // Velocidad
  const speed = form.querySelector('input[name="speed"]:checked')?.value;
  if (!speed) return (formError.textContent = 'Selecciona la velocidad.');

  // Comidas
  if (!breakfastEl?.value) return (formError.textContent = 'Selecciona el desayuno.');
  if (!lunchEl?.value) return (formError.textContent = 'Selecciona la comida.');

  const user = auth.currentUser;
  if (!user) return (formError.textContent = "Inicia sesión.");

  // Construcción del payload (añade opcionales solo si tienen valor)
  const payload = {
    name: routeNameEl.value.trim(),

    date: routeDateEl.value,               // YYYY-MM-DD
    time: routeTimeEl.value,               // HH:MM (salida)
    ...(arrivalTimeEl.value && { arrivalTime: arrivalTimeEl.value }),

    start: {
      name: startNameEl.value.trim(),
      link: startLinkEl.value.trim(),
    },

    endPoint: endPointEl.value.trim(),
    ...(routeLinkEl.value && { routeLink: routeLinkEl.value.trim() }),
    ...(distanceKmEl.value && { distanceKm: Number(distanceKmEl.value) }),

    speed,                                 // 'chill' | 'alegre' | 'album'
    meals: {
      breakfast: breakfastEl.value,        // 'casa' | 'bocata' | 'restaurante'
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
    window.location.href = "../rutas/rutas.html";
  } catch (err) {
    console.error("Error guardando ruta:", err);
    form.querySelector('button[type="submit"]').disabled = false;
    formError.textContent = "No se pudo guardar la ruta. Revisa la consola y las reglas.";
  }
});

cancelBtn.addEventListener('click', () => {
  if (confirm("¿Descartar cambios?")) window.location.href = "../rutas/rutas.html";
});
