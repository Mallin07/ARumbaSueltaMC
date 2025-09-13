// IDs clave para Firebase más adelante
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

const form = document.getElementById('userForm');

// Datos simulados (puedes cargarlos desde Firebase más adelante)
const initialData = {
  photoURL: 'assets/default-avatar.png',
  name: 'Nombre Apellido',
  username: 'mi_usuario',
  email: 'correo@ejemplo.com',
  bikeStyle: 'naked',
  displacement: '300',
  memberNumber: 'MC-001', // ← Nuevo
};

// Estado para restaurar si cancelas
let snapshot = null;

// Inicializa valores
function populate(data){
  if (data.photoURL) userPhoto.src = data.photoURL;
  nameInput.value = data.name ?? '';
  usernameInput.value = data.username ?? '';
  emailInput.value = data.email ?? '';
  bikeStyleSelect.value = data.bikeStyle ?? '';
  displacementSelect.value = data.displacement ?? '';
  memberValue.textContent = data.memberNumber ?? '—';
}
populate(initialData);

// Alterna modo edición
function setEditing(editing){
  [nameInput, usernameInput, emailInput, bikeStyleSelect, displacementSelect].forEach(el => {
    el.disabled = !editing;
  });
  changePhotoBtn.disabled = !editing;

  editBtn.hidden = editing;
  saveBtn.hidden = !editing;
  cancelBtn.hidden = !editing;
}

// Click en “Editar”
editBtn.addEventListener('click', () => {
  // guarda snapshot para poder cancelar
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

// Cambiar foto
changePhotoBtn.addEventListener('click', () => {
  photoInput.click();
});

// Previsualización de foto
photoInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  // Validación simple: peso y tipo
  const maxSizeMB = 5;
  if (!file.type.startsWith('image/')){
    alert('Selecciona un archivo de imagen.');
    photoInput.value = '';
    return;
  }
  if (file.size > maxSizeMB * 1024 * 1024){
    alert(`La imagen supera ${maxSizeMB}MB.`);
    photoInput.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    userPhoto.src = reader.result; // previsualiza
  };
  reader.readAsDataURL(file);
});

// Guardar (aquí es donde luego llamarás a Firebase)
saveBtn.addEventListener('click', async () => {
  // Validaciones mínimas
  if (!emailInput.value.includes('@')){
    alert('Introduce un correo válido.');
    return;
  }

  const payload = {
    name: nameInput.value.trim(),
    username: usernameInput.value.trim(),
    email: emailInput.value.trim(),
    bikeStyle: bikeStyleSelect.value,
    displacement: displacementSelect.value,
    // La foto:
    // - Si usas Firebase Storage, sube 'photoInput.files[0]' y guarda la URL.
    // - Si no ha cambiado, puedes mantener userPhoto.src si ya es una URL.
  };

  // 🔜 Aquí integrarías Firebase:
  // 1) Subir foto a Firebase Storage (si hay archivo)
  // 2) Obtener downloadURL
  // 3) Guardar payload + photoURL en Firestore/Realtime DB
  // try { ... } catch (err) { ... }

  console.log('Datos a guardar:', payload);
  alert('Datos guardados (demo). Integra Firebase para persistir.');

  // Tras guardar, resetea input de archivo y bloquea edición
  photoInput.value = '';
  setEditing(false);
});

// Cancelar
cancelBtn.addEventListener('click', () => {
  if (snapshot){
    populate(snapshot);
    userPhoto.src = snapshot.photoURL;
  }
  photoInput.value = '';
  setEditing(false);
});

// Modo inicial: solo lectura
setEditing(false);
