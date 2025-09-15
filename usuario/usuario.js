// usuario/usuario.js  (ES module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc,
  collection, query, where, getDocs, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// 🔑 Tu config
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
const storage = getStorage(app);

// ------- refs UI -------
const userPhoto = document.getElementById('userPhoto');
const photoInput = document.getElementById('photoInput');
const changePhotoBtn = document.getElementById('changePhotoBtn');

const nameInput = document.getElementById('nameInput');
const usernameInput = document.getElementById('usernameInput');
const emailInput = document.getElementById('emailInput');
const bikeStyleSelect = document.getElementById('bikeStyleSelect');
const displacementSelect = document.getElementById('displacementSelect');
const memberValue = document.getElementById('memberValue');

const editBtn = document.getElementById('editBtn');
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');

let snapshot = null;

// ------- helpers -------
function fmt(n) {
  if (!n && n !== 0) return "—";
  return `ARSMC - ${String(n).padStart(3, "0")}`;
}
function populate(data){
  if (data.photoURL) userPhoto.src = data.photoURL;
  nameInput.value = data.name ?? '';
  usernameInput.value = data.username ?? '';
  emailInput.value = data.email ?? '';
  bikeStyleSelect.value = data.bikeStyle ?? '';
  displacementSelect.value = data.displacement ?? '';
  memberValue.textContent = fmt(data.memberNumber);
}
function setEditing(editing){
  [nameInput, usernameInput, emailInput, bikeStyleSelect, displacementSelect].forEach(el => el.disabled = !editing);
  changePhotoBtn.disabled = !editing;
  editBtn.hidden = editing;
  saveBtn.hidden = !editing;
  cancelBtn.hidden = !editing;
}

// Migración opcional: si NO existe users/{uid}, intenta encontrar un doc antiguo por email y lo copia
async function migrateLegacyDocIfAny(user) {
  const userRef = doc(db, "users", user.uid);
  const current = await getDoc(userRef);
  if (current.exists()) return current.data();

  // Busca en /users por email == user.email
  const q = query(collection(db, "users"), where("email", "==", user.email));
  const qs = await getDocs(q);
  if (qs.empty) return null;

  const legacy = qs.docs.find(d => d.id !== user.uid) || qs.docs[0];
  const data = legacy.data();

  // Crea el doc correcto
  await setDoc(userRef, data, { merge: true });

  // Intenta borrar el viejo (si las reglas lo permiten)
  try { if (legacy.id !== user.uid) await deleteDoc(legacy.ref); } catch {}

  return data;
}

// ------- auth guard + carga de datos -------
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "../index.html";
    return;
  }

  try {
    // 1) Intenta migrar (si ya existía con ID “raro”)
    const migrated = await migrateLegacyDocIfAny(user);
    if (migrated) {
      populate(migrated);
      setEditing(false);
      return;
    }

    // 2) Carga normal
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      populate(snap.data());
    } else {
      // 3) Crea base si no existe
      const base = {
        name: user.displayName || "",
        username: user.email?.split("@")[0] || "",
        email: user.email || "",
        bikeStyle: "",
        displacement: "",
        photoURL: "assets/default-avatar.png" // ojo: ruta relativa a /usuario/
      };
      await setDoc(userRef, base, { merge: true });
      populate(base);
    }
  } catch (e) {
    console.error("Error cargando perfil:", e);
    alert("No se pudo cargar tu perfil. Revisa permisos/reglas y la consola.");
  } finally {
    setEditing(false);
  }
});

// ------- UI -------
editBtn.addEventListener('click', () => {
  snapshot = {
    photoURL: userPhoto.src,
    name: nameInput.value,
    username: usernameInput.value,
    email: emailInput.value,
    bikeStyle: bikeStyleSelect.value,
    displacement: displacementSelect.value,
  };
  setEditing(true);
});
changePhotoBtn.addEventListener('click', () => photoInput.click());

photoInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const maxSizeMB = 5;
  if (!file.type.startsWith('image/')) { alert('Selecciona una imagen.'); photoInput.value=''; return; }
  if (file.size > maxSizeMB * 1024 * 1024) { alert(`La imagen supera ${maxSizeMB}MB.`); photoInput.value=''; return; }

  const reader = new FileReader();
  reader.onload = () => { userPhoto.src = reader.result; };
  reader.readAsDataURL(file);
});

saveBtn.addEventListener('click', async () => {
  const user = auth.currentUser;
  if (!user) { alert("Inicia sesión para subir tu foto."); return; }
  if (!emailInput.value.includes('@')){ alert('Introduce un correo válido.'); return; }

  let photoURL = null;

  try {
    // 1) Subir foto si hay nueva
    if (photoInput.files && photoInput.files[0]) {
      const file = photoInput.files[0];
      if (!file.type.startsWith('image/')) throw new Error('Tipo no válido');
      if (file.size > 5 * 1024 * 1024) throw new Error('Archivo > 5MB');

      const fileRef = ref(storage, `avatars/${user.uid}/${Date.now()}-${file.name}`);
      await uploadBytes(fileRef, file);
      photoURL = await getDownloadURL(fileRef);
    }

    // 2) Guardar perfil (sin memberNumber)
    const payload = {
      name: nameInput.value.trim(),
      username: usernameInput.value.trim(),
      email: emailInput.value.trim(),
      bikeStyle: bikeStyleSelect.value,
      displacement: displacementSelect.value,
      ...(photoURL ? { photoURL } : {})
    };
    await setDoc(doc(db, "users", user.uid), payload, { merge: true });

    alert('Datos guardados');
    photoInput.value = '';
    setEditing(false);
  } catch (e) {
    console.error("Upload/Save error:", e);
    alert("No se pudo guardar. Revisa sesión, reglas de Firestore/Storage y consola.");
  }
});

cancelBtn.addEventListener('click', () => {
  if (snapshot) populate(snapshot);
  photoInput.value = '';
  setEditing(false);
});

// modo inicial
setEditing(false);
