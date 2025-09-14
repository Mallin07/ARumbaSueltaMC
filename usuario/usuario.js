// usuario/usuario.js  (ES module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// 🔑 Pega aquí tu configuración real
const firebaseConfig = {
  apiKey: "AIzaSyBDIpcNGu8KjndeSD8V6etZ1MeRMVYi_Yw",
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

let currentUID = null;
let snapshot = null;

// ------- helpers -------
function populate(data){
  if (data.photoURL) userPhoto.src = data.photoURL;
  nameInput.value = data.name ?? '';
  usernameInput.value = data.username ?? '';
  emailInput.value = data.email ?? '';
  bikeStyleSelect.value = data.bikeStyle ?? '';
  displacementSelect.value = data.displacement ?? '';
  memberValue.textContent = data.memberNumber ?? '—';
}

function setEditing(editing){
  [nameInput, usernameInput, emailInput, bikeStyleSelect, displacementSelect].forEach(el => el.disabled = !editing);
  changePhotoBtn.disabled = !editing;
  editBtn.hidden = editing;
  saveBtn.hidden = !editing;
  cancelBtn.hidden = !editing;
}

// ------- auth guard + carga de datos -------
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // si no hay sesión, envía al login
    window.location.href = "../login.html"; // ajusta ruta según dónde esté tu login
    return;
  }
  currentUID = user.uid;

  const userRef = doc(db, "users", currentUID);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    populate(snap.data());
  } else {
    // crea doc base (el memberNumber lo rellenas tú luego desde la consola)
    const base = {
      name: user.displayName || "",
      username: user.email?.split("@")[0] || "",
      email: user.email || "",
      bikeStyle: "",
      displacement: "",
      photoURL: "assets/default-avatar.png"
    };
    await setDoc(userRef, base, { merge: true });
    populate(base);
  }
  setEditing(false);
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
    memberNumber: memberValue.textContent,
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
  if (!currentUID) return;
  if (!emailInput.value.includes('@')){ alert('Introduce un correo válido.'); return; }

  // 1) Subir foto si hay nueva
  let photoURL = null;
  if (photoInput.files && photoInput.files[0]) {
    const file = photoInput.files[0];
    const fileRef = ref(storage, `avatars/${currentUID}/${Date.now()}-${file.name}`);
    await uploadBytes(fileRef, file);
    photoURL = await getDownloadURL(fileRef);
  }

  // 2) Payload (sin memberNumber)
  const payload = {
    name: nameInput.value.trim(),
    username: usernameInput.value.trim(),
    email: emailInput.value.trim(),
    bikeStyle: bikeStyleSelect.value,
    displacement: displacementSelect.value,
  };
  if (photoURL) payload.photoURL = photoURL;

  // 3) Guardar
  const userRef = doc(db, "users", currentUID);
  await setDoc(userRef, payload, { merge: true });

  alert('Datos guardados');
  photoInput.value = '';
  setEditing(false);
});

cancelBtn.addEventListener('click', () => {
  if (snapshot) populate(snapshot);
  photoInput.value = '';
  setEditing(false);
});

// modo inicial
setEditing(false);
