import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, collection, query, where, orderBy, onSnapshot,
  doc, getDoc, setDoc, deleteDoc, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Config
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

// UI
const routesList = document.getElementById("routesList");
const emptyMsg = document.getElementById("emptyMsg");
const EMPTY_TEXT = emptyMsg.textContent; // "No hay rutas próximas."

// Helpers
const todayStr = () => new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD

function speedLabel(v){
  return v === "chill" ? "Vamos del chill 🐢"
       : v === "alegre" ? "Alegres pero sin peligro ⚡"
       : v === "album" ? "Queremos un álbum de fotos 📸"
       : "—";
}
function mealLabel(v){
  return v === "casa" ? "En casa" : v === "bocata" ? "Bocatas" : v === "restaurante" ? "Restaurante" : "—";
}

// Compat: salida nombre + link (nuevo o antiguo)
function getStartInfo(data){
  const name = data.start?.name || "Salida";
  const link = data.start?.link || data.startLink || "";
  return { name, link };
}

function fmtDistance(km){
  if (km === undefined || km === null || Number.isNaN(Number(km))) return "— km";
  const n = Number(km);
  return (Number.isInteger(n) ? n : n.toFixed(1)) + " km";
}

function routeCardTemplate(routeId, data, joined, count){
  const speed = speedLabel(data.speed);
  const breakfast = mealLabel(data.meals?.breakfast);
  const lunch = mealLabel(data.meals?.lunch);
  const { name: startName, link: startLink } = getStartInfo(data);

  const arrival = data.arrivalTime || "—";
  const distanceTxt = fmtDistance(data.distanceKm);

  return `
    <div class="route" data-id="${routeId}">
      <div>
        <h2>${data.name || "Ruta"}</h2>
        <div class="meta">
          <span>📅 ${data.date || "—"}</span>
          <span>⏱️ ${data.time || "—"} — ${arrival}</span>
          <span>🚩 ${
            startLink
              ? `<a class="link" href="${startLink}" target="_blank" rel="noreferrer">${startName}</a>`
              : `${startName}`
          }</span>
          <span>🏁 ${data.endPoint || "—"}</span>
          ${data.routeLink ? `<span>🗺️ <a class="link" href="${data.routeLink}" target="_blank" rel="noreferrer">Ruta</a></span>` : ""}
        </div>

        <div class="badges" style="margin-top:.4rem;">
          <span class="badge">Velocidad: ${speed}</span>
          <span class="badge">Desayuno: ${breakfast}</span>
          <span class="badge">Comida: ${lunch}</span>
          <span class="badge">Distancia: ${distanceTxt}</span>
        </div>
      </div>

      <div class="actions">
        <button class="btn join-btn ${joined ? "danger" : ""}" data-id="${routeId}">
          ${joined ? "Desapuntarme" : "Apuntarme"}
        </button>
        <button class="btn toggle-att" data-id="${routeId}">Apuntados</button>
        <span class="count" data-id="${routeId}">(${count})</span>
      </div>

      <div class="attendees">
        <div class="details" id="att-${routeId}"></div>
      </div>
    </div>
  `;
}

async function getAttendeesCount(routeId){
  const snap = await getDocs(collection(db, "routes", routeId, "attendees"));
  return snap.size;
}
async function userJoinedRoute(routeId, uid){
  if (!uid) return false;
  const snap = await getDoc(doc(db, "routes", routeId, "attendees", uid));
  return snap.exists();
}
async function loadAttendees(routeId){
  const wrap = document.getElementById(`att-${routeId}`);
  if (!wrap) return;
  wrap.innerHTML = `<p class="muted">Cargando asistentes…</p>`;
  const qs = await getDocs(collection(db, "routes", routeId, "attendees"));
  if (qs.empty){ wrap.innerHTML = `<p class="muted">Nadie se ha apuntado todavía.</p>`; return; }
  const rows = qs.docs.map(d => {
    const a = d.data();
    const avatar = a.photoURL || "../usuario/assets/default-avatar.png";
    const name = a.name || a.username || a.email || "Usuario";
    const meta = [a.username, a.bikeStyle, a.displacement ? (a.displacement + "cc") : ""]
      .filter(Boolean).join(" · ");
    return `
      <div class="att-row">
        <img class="att-avatar" src="${avatar}" alt="">
        <span class="att-name">${name}</span>
        <span class="att-meta"> ${meta}</span>
      </div>`;
  }).join("");
  wrap.innerHTML = rows;
  wrap.classList.add("open");
}

// Join / Unjoin
async function toggleJoin(routeId){
  const user = auth.currentUser;
  if (!user){ window.location.href = "../index.html"; return; }

  const myDocRef = doc(db, "routes", routeId, "attendees", user.uid);
  const cur = await getDoc(myDocRef);
  if (cur.exists()){
    await deleteDoc(myDocRef);
    return { joined:false };
  } else {
    const uref = doc(db, "users", user.uid);
    const usnap = await getDoc(uref);
    const u = usnap.exists() ? usnap.data() : {};
    const info = {
      uid: user.uid,
      name: u.name || "",
      username: u.username || "",
      email: u.email || user.email || "",
      bikeStyle: u.bikeStyle || "",
      displacement: u.displacement || "",
      photoURL: u.photoURL || "",
      joinedAt: new Date()
    };
    await setDoc(myDocRef, info, { merge: true });
    return { joined:true };
  }
}

let unsubscribe = null;

function attachButtonHandlers(){
  const container = document.getElementById("routesList");

  // --- JOIN / DESAPUNTAR ---
  container.querySelectorAll(".join-btn").forEach(btn => {
    btn.replaceWith(btn.cloneNode(true)); // limpia listeners previos
  });
  container.querySelectorAll(".join-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const rid = e.currentTarget.dataset.id;
      btn.disabled = true;
      try {
        const res = await toggleJoin(rid);
        btn.textContent = res.joined ? "Desapuntarme" : "Apuntarme";
        btn.classList.toggle("danger", res.joined);

        const countEl = container.querySelector(`.count[data-id="${rid}"]`);
        const current = parseInt(countEl.textContent.replace(/[()]/g,"")) || 0;
        countEl.textContent = `(${res.joined ? current + 1 : current - 1})`;
      } finally {
        btn.disabled = false;
      }
    });
  });

  // --- APUNTADOS (abrir/cerrar lista) ---
  container.querySelectorAll(".toggle-att").forEach(btn => {
    btn.replaceWith(btn.cloneNode(true)); // limpia listeners previos
  });
  container.querySelectorAll(".toggle-att").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const rid = e.currentTarget.dataset.id;
      const panel = document.getElementById(`att-${rid}`);
      if (!panel) return;

      if (!panel.classList.contains("open")){
        await loadAttendees(rid);
      } else {
        panel.classList.remove("open");
        panel.innerHTML = "";
      }
    });
  });
}

// Render listado (sólo próximas) con fallback si falta índice
function setupList(){
  // consulta compuesta (date >= hoy, orderBy date + time)
  const qCompound = query(
    collection(db, "routes"),
    where("date", ">=", todayStr()),
    orderBy("date"),
    orderBy("time")
  );

  // consulta simple (sin orderBy time)
  const qSimple = query(
    collection(db, "routes"),
    where("date", ">=", todayStr()),
    orderBy("date")
  );

  const render = async (snap) => {
    const container = document.getElementById("routesList");
    container.innerHTML = "";

    if (snap.empty){
      emptyMsg.textContent = EMPTY_TEXT; // asegura el texto correcto
      emptyMsg.hidden = false;
      return;
    }

    emptyMsg.hidden = true;
    emptyMsg.textContent = EMPTY_TEXT;

    const uid = auth.currentUser?.uid;

    for (const docSnap of snap.docs){
      const data = docSnap.data();
      const id = docSnap.id;
      if (data.date < todayStr()) continue;

      const [count, joined] = await Promise.all([
        getAttendeesCount(id),
        userJoinedRoute(id, uid)
      ]);

      container.insertAdjacentHTML("beforeend", routeCardTemplate(id, data, joined, count));
    }

    attachButtonHandlers();
  };

  // Limpia anterior suscripción si la hubiera
  if (typeof unsubscribe === "function") { unsubscribe(); unsubscribe = null; }

  // Intenta con compuesta; si falla por índice, usa simple (sin tocar emptyMsg para "cargando…")
  unsubscribe = onSnapshot(
    qCompound,
    render,
    (error) => {
      console.warn("Consulta compuesta falló:", error);
      if (error?.code === "failed-precondition") {
        if (typeof unsubscribe === "function") { unsubscribe(); }
        unsubscribe = onSnapshot(
          qSimple,
          render,
          (err2) => {
            console.error("Error cargando rutas (simple):", err2);
            emptyMsg.hidden = false;
            emptyMsg.textContent =
              err2?.code === "permission-denied"
                ? "No tienes permiso para leer las rutas (revisa reglas)."
                : "No se pudieron cargar las rutas.";
          }
        );
      } else if (error?.code === "permission-denied") {
        emptyMsg.hidden = false;
        emptyMsg.textContent = "No tienes permiso para leer las rutas (revisa reglas).";
      } else {
        emptyMsg.hidden = false;
        emptyMsg.textContent = "No se pudieron cargar las rutas.";
      }
    }
  );
}

// Auth + init
onAuthStateChanged(auth, () => {
  setupList(); // visible también para no logueados; al unirse se fuerza login
});

