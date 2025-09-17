import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBDIpcNGu8KjndeSD8V6etZ1MeRMVYi_Yw",
  authDomain: "arsmc-873f3.firebaseapp.com",
  projectId: "arsmc-873f3",
  storageBucket: "arsmc-873f3.firebasestorage.app",
  messagingSenderId: "558517245585",
  appId: "1:558517245585:web:9816b346b67c4d7cb69130",
  measurementId: "G-8WGXBDMSVZ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

onAuthStateChanged(auth, (user) => {
  if (!user) {
    // window.location.href = "login.html";
  }
});

const grid = document.getElementById('usersGrid');

function fmtMember(n) {
  if (n === undefined || n === null || n === '') return '—';
  const num = String(n).replace(/\D/g, '');
  if (!num) return '—';
  return `ARSMC - ${num.padStart(3, '0')}`;
}

// ➜ AQUÍ el mapeo definitivo para que aparezca “<cc”
function fmtDisplacement(val) {
  const map = {
    "125": "125cc",
    "300": "300&lt;cc",
    "500": "500&lt;cc",
    "600": "600&lt;cc",
    "900": "900&lt;cc"
  };
  if (!val) return "—";
  return map[val] || (String(val) + "cc");
}

function cardTemplate(u) {
  const photo = u.photoURL || "assets/default-avatar.png";
  const username = u.username || 'Usuario';
  const email = u.email || '—';
  const style = u.bikeStyle || '—';
  const disp = fmtDisplacement(u.displacement);
  const member = fmtMember(u.memberNumber);

  return `
  <article class="card">
    <div class="top">
      <img src="${photo}" alt="Foto de ${username}">
      <div>
        <h3>${username}</h3>
      </div>
    </div>
    <div class="meta">
      <p><strong>Correo:</strong> ${email}</p>
      <p><strong>Estilo:</strong> ${style}</p>
      <p><strong>Cilindrada:</strong> ${disp}</p>
      <p><strong>Matrícula de socio:</strong> ${member}</p>
    </div>
  </article>`;
}

async function loadUsers() {
  grid.innerHTML = "Cargando...";
  const q = query(collection(db, "users"), orderBy("username", "asc"));
  const snap = await getDocs(q);
  const html = [];
  snap.forEach(docSnap => html.push(cardTemplate(docSnap.data())));
  grid.innerHTML = html.length ? html.join("") : "<p>No hay usuarios todavía.</p>";
}

loadUsers();
