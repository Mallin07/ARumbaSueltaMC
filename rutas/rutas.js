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

// Helpers
const todayStr = () => {
  // YYYY-MM-DD local (sv-SE)
  return new Date().toLocaleDateString('sv-SE'); // e.g. "2025-09-14"
};

function speedLabel(v){
  return v === "chill" ? "Vamos del chill 🐢"
       : v === "alegre" ? "Alegres pero sin peligro ⚡"
       : v === "album" ? "Queremos un álbum de fotos 📸"
       : "—";
}
function mealLabel(v){
  return v === "casa" ? "En casa" : v === "bocata" ? "Bocatas" : v === "restaurante" ? "Restaurante" : "—";
}

function routeCardTemplate(routeId, data, joined, count){
  const stopsText = (data.stops?.length ? `${data.stops.length} parada(s)` : "Sin paradas");
  const speed = speedLabel(data.speed);
  const breakfast = mealLabel(data.meals?.breakfast);
  const lunch = mealLabel(data.meals?.lunch);

  return `
    <div class="route" data-id="${routeId}">
      <div>
        <h2>${data.name}</h2>
        <div class="meta">
          <span>📅 ${data.date}</span>
          <span>⏰ ${data.time}</span>
          <span>🚩 <a class="link" href="${data.startLink}" target="_blank" rel="noreferrer">Salida</a></span>
          <span>🏁 ${data.endPoint}</span>
          <span>🗺️ <a class="link" href="${data.routeLink}" target="_blank" rel="noreferrer">Ruta</a></span>
        </div>
        <div class="badges" style="margin-top:.4rem;">
          <span class="badge">${stopsText}</span>
          <span class="badge">${speed}</span>
          <span class="badge">Desayuno: ${breakfast}</span>
          <span class="badge">Comida: ${lunch}</span>
        </div>
      </div>

      <div class="actions">
        <button class="btn join-btn" data-id="${routeId}">${joined ? "Desapuntarme" : "Apuntarme"}</button>
        <button class="btn ghost toggle-att" data-id="${routeId}">Apuntados</button>
        <span class="count" data-id="${routeId}">(${count})</span>
      </div>

      <div class="attendees">
        <div class="details" id="att-${routeId}">
          <!-- filas de asistentes -->
        </div>
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
    // Desapuntarse
    await deleteDoc(myDocRef);
    return { joined:false };
  } else {
    // Cargar info básica del perfil
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
      joinedAt: new Date() // solo decorativo; las reglas pueden permitirlo
    };
    await setDoc(myDocRef, info, { merge: true });
    return { joined:true };
  }
}

// Render listado (sólo próximas)
function setupList(){
  const qrt = query(
    collection(db, "routes"),
    where("date", ">=", todayStr()),
    orderBy("date"), orderBy("time")
  );

  onSnapshot(qrt, async (snap) => {
    // Limpia
    routesList.innerHTML = "";
    if (snap.empty){ emptyMsg.hidden = false; return; }
    emptyMsg.hidden = true;

    const uid = auth.currentUser?.uid;

    // Construye cards (con counts y estado de unión)
    for (const docSnap of snap.docs){
      const data = docSnap.data();
      const id = docSnap.id;

      // seguridad extra en cliente: ocultar vencidas si el reloj local va mal
      if (data.date < todayStr()) continue;

      const [count, joined] = await Promise.all([
        getAttendeesCount(id),
        userJoinedRoute(id, uid)
      ]);

      routesList.insertAdjacentHTML("beforeend", routeCardTemplate(id, data, joined, count));
    }

    // Wire up botones
    routesList.querySelectorAll(".join-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const rid = e.currentTarget.getAttribute("data-id");
        e.currentTarget.disabled = true;
        try{
          const res = await toggleJoin(rid);
          // Actualiza botón y contador
          e.currentTarget.textContent = res.joined ? "Desapuntarme" : "Apuntarme";
          const countEl = routesList.querySelector(`.count[data-id="${rid}"]`);
          const current = parseInt(countEl.textContent.replace(/[()]/g,"")) || 0;
          countEl.textContent = `(${res.joined ? current+1 : current-1})`;
        } finally{
          e.currentTarget.disabled = false;
        }
      });
    });

    routesList.querySelectorAll(".toggle-att").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const rid = e.currentTarget.getAttribute("data-id");
        const panel = document.getElementById(`att-${rid}`);
        if (!panel?.classList.contains("open")){
          await loadAttendees(rid);
        } else {
          panel.classList.remove("open");
          panel.innerHTML = "";
        }
      });
    });
  });
}

// Auth + init
onAuthStateChanged(auth, () => {
  setupList(); // lista visible también para no logueados; al unirse se fuerza login
});
