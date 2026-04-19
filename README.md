# REV POS — Mueblería Mi Pueblito

Sistema de Punto de Venta para Mueblería Mi Pueblito.  
Construido con HTML, CSS y JavaScript puro (sin bundlers). Datos locales en `localStorage` con sincronización opcional a Firebase Firestore y respaldos a OneDrive.

---

## 🌐 Publicar en GitHub Pages

1. Ve a **Settings → Pages** en tu repositorio.
2. En **Source**, selecciona **Deploy from a branch**.
3. Elige la rama `main` y la carpeta `/root (root)`.
4. Guarda los cambios. En pocos minutos tu app estará en:  
   `https://<tu-usuario>.github.io/<nombre-del-repo>/`

---

## 🔐 Configurar Firebase Auth

### 1. Activar autenticación Email/Contraseña

1. En Firebase Console → **Authentication** → **Sign-in method**.
2. Habilita **Correo electrónico/contraseña** y guarda los cambios.

### 2. Crear el primer usuario administrador

1. En **Authentication → Users → Agregar usuario**.
2. Ingresa un correo y contraseña para el administrador.
3. Copia el **UID** que aparece en la tabla de usuarios.

### 3. Crear el perfil del admin en Firestore

1. En **Firestore Database → Datos → Nueva colección**: nombre `usuarios`.
2. ID del documento: pega el UID copiado en el paso anterior.
3. Agrega los campos:
   - `nombre` (string): `"Administrador"` (o el nombre real)
   - `rol` (string): `"admin"`
   - `email` (string): el correo del admin
   - `activo` (boolean): `true`

### 4. Pegar las reglas de seguridad

En **Firestore → Reglas**, pega el contenido del archivo `firestore.rules` incluido en este repositorio:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /posData/{document} {
      allow read, write: if request.auth != null;
    }
    match /usuarios/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && (
        request.auth.uid == uid ||
        get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.rol == 'admin'
      );
    }
  }
}
```

### 5. Flujo de inicio de sesión

Una vez configurado Firebase Auth, la pantalla de login solicitará **email + contraseña** en lugar de usuario + PIN.

- Si Firebase está activo → autenticación real con Firebase Auth + perfil desde Firestore.
- Si Firebase no está configurado → fallback a usuarios locales (usuario/PIN en localStorage).

---



### 1. Crear proyecto en Firebase Console

1. Ve a [console.firebase.google.com](https://console.firebase.google.com/) e inicia sesión.
2. Haz clic en **Agregar proyecto** y sigue los pasos.
3. En el panel del proyecto ve a **Firestore Database → Crear base de datos**.
4. Elige **Iniciar en modo de producción** y selecciona tu región.

### 2. Obtener credenciales

1. En el panel ve a **Configuración del proyecto** (ícono ⚙️).
2. En la sección **Tus apps** haz clic en **Agregar app → Web** (`</>`).
3. Registra la app (cualquier nombre) y copia el objeto `firebaseConfig`.

### 3. Pegar credenciales en el sistema

Abre el archivo `js/services/firebase-config.js` y reemplaza los valores:

```javascript
const firebaseConfig = {
    apiKey: "AIzaSy...",
    authDomain: "mi-proyecto.firebaseapp.com",
    projectId: "mi-proyecto",
    storageBucket: "mi-proyecto.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123"
};
```

### 4. Reglas de seguridad recomendadas

En **Firestore → Reglas**, pega lo siguiente (ajusta según tus necesidades):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Solo usuarios autenticados pueden leer/escribir la colección posData
    match /posData/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

> **Nota:** Si no usas Firebase Authentication, puedes usar reglas más permisivas para desarrollo:
> ```
> allow read, write: if true;
> ```
> ⚠️ **No uses `allow read, write: if true` en producción.**

---

## 💾 Configurar OneDrive (respaldos automáticos)

### 1. Registrar aplicación en Azure AD

1. Ve a [portal.azure.com](https://portal.azure.com/) e inicia sesión.
2. Busca **Azure Active Directory → Registros de aplicaciones → Nuevo registro**.
3. Configura:
   - **Nombre:** REV POS Backup
   - **Tipos de cuenta admitidos:** Cuentas en cualquier directorio organizativo y cuentas Microsoft personales
   - **URI de redireccionamiento:** Tipo `SPA (aplicación de página única)` con las siguientes URLs:
     - `http://localhost` (para desarrollo local)
     - `https://<tu-usuario>.github.io` (para producción en GitHub Pages)
4. Haz clic en **Registrar**.
5. Copia el **Id. de aplicación (cliente)** que aparece en la pantalla de resumen.

### 2. Pegar el Client ID en el sistema

Abre `js/services/onedrive-backup.js` y reemplaza:

```javascript
const _msalConfig = {
    auth: {
        clientId: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", // ← pega aquí el Client ID
        ...
    }
};
```

### 3. Permisos requeridos

En la app de Azure AD ve a **Permisos de API → Agregar permiso → Microsoft Graph → Permisos delegados** y agrega:
- `Files.ReadWrite`
- `User.Read`

---

## 📁 Backup manual (JSON)

En el menú lateral ve a **⚙️ CONFIGURACIÓN → ☁️ Nube y Respaldos**.

- **Exportar todos los datos** — descarga un archivo `.json` con todos los datos del sistema.
- **Importar backup** — selecciona un archivo `.json` previamente exportado para restaurar los datos.

---

## 🗂️ Estructura del proyecto

```
rev/
├── index.html                   # Aplicación principal
├── estilos.css                  # Estilos globales
├── script.js                    # Versión monolítica de referencia (no usar)
└── js/
    ├── services/
    │   ├── storage.js           # StorageService (localStorage + Firebase write-through)
    │   ├── firebase-config.js   # Inicialización Firebase
    │   ├── onedrive-backup.js   # Respaldos OneDrive + exportar/importar JSON
    │   ├── calculator.js
    │   └── validator.js
    ├── core/
    │   ├── data.js
    │   └── navigation.js
    ├── modules/
    │   ├── auth.js              # Login, roles, gestión de usuarios
    │   ├── inventario.js
    │   ├── ventas.js
    │   ├── clientes.js
    │   ├── compras.js
    │   ├── bancos.js
    │   ├── gastos.js
    │   ├── cotizaciones.js
    │   ├── devoluciones.js
    │   ├── puntos.js
    │   ├── descuentos.js
    │   ├── vendedores.js
    │   ├── proyeccion.js
    │   ├── agenda.js
    │   ├── notificaciones.js
    │   ├── dashboard.js
    │   └── ...
    └── init.js
```

---

## 👤 Usuarios por defecto

> Si Firebase Auth **no está configurado**, el sistema usa usuarios locales de `localStorage`:

| Usuario | PIN  | Rol         |
|---------|------|-------------|
| admin   | 1234 | Administrador (acceso total) |
| vendedor | 0000 | Vendedor (solo menú de ventas) |

> Con Firebase Auth activo, el login solicita **email + contraseña**. Los usuarios deben crearse en Firebase Console (ver sección **Configurar Firebase Auth**).

Puedes gestionar usuarios en **⚙️ CONFIGURACIÓN → Usuarios del sistema** (solo admins).

