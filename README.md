# NovaPack - Generador de Albaranes

Esta es una aplicación web para la gestión de albaranes de Novapack, diseñada con los colores corporativos (Naranja, Blanco, Negro).

## Características

- **Base de Datos en la Nube**: Cada usuario tiene su propia lista de albaranes (requiere Firebase).
- **Acceso Remoto**: Puede usarse desde cualquier dispositivo con navegador web.
- **Diseño Premium**: Interfaz moderna y responsiva.

## Instrucciones de Instalación

### 1. Configuración de la Nube (Firebase)

Para que la base de datos funcione, necesitas un proyecto de Google Firebase (gratuito):

1. Ve a [console.firebase.google.com](https://console.firebase.google.com/) e inicia sesión.
2. Crea un nuevo proyecto (ej. "Novapack App").
3. En el panel izquierdo, ve a **Compilación > Authentication**.
   - Haz clic en **Comenzar**.
   - Habilita el proveedor **Correo electrónico/contraseña**.
4. Ve a **Compilación > Firestore Database**.
   - Haz clic en **Crear base de datos**.
   - Selecciona iniciar en **modo de prueba** (por ahora) y elige una ubicación cercana (ej. `eur3`).
5. Registra la aplicación web:
   - Ve a la **Rueda de engranaje** (Configuración del proyecto) > General.
   - Baja hasta "Tus apps" y haz clic en el icono (`</>`) de Web.
   - Registra la app (ej. "Novapack Web").
   - **IMPORTANTE**: Copia el contenido de `const firebaseConfig = { ... }`. Solo necesitas lo que está dentro de las llaves `{ ... }`.

### 2. Ejecutar la Aplicación

1. Abre el archivo `index.html` en tu navegador (Chrome, Edge, etc.).
2. Verás una pantalla pidiéndote la "Configuración de Base de Datos".
3. Pega el código JSON que copiaste de Firebase (ej. `{"apiKey": "AIza...", ...}`).
4. Guarda y recarga.
5. ¡Listo! Regístrate con un email y contraseña y empieza a crear albaranes.

## Despliegue (Acceso Remoto)

Para acceder desde el móvil u otros ordenadores, necesitas "subir" estos archivos a internet.
Opciones recomendadas:

- **Netlify/Vercel**: Arrastra la carpeta del proyecto a sus paneles de despliegue.
- **Firebase Hosting**: Si instalas las herramientas de Firebase (`npm install -g firebase-tools`), puedes usar `firebase deploy`.

## Tecnologías

- HTML5 / CSS3 (Vanilla)
- JavaScript (ES6)
- Firebase (Auth + Firestore)

## Cómo subir a GitHub (Publicar en Internet)

Como esta aplicación no requiere "construcción" (build), subirla es muy fácil:

1. Crea una cuenta en [GitHub.com](https://github.com).
2. Crea un **Nuevo Repositorio** (botón "New" o "+").
   - Ponle nombre: `novapack-webapp`
   - Marca la casilla "Add a README file" (opcional).
   - Pulsa "Create repository".
3. En la página del repositorio, pulsa **Add file** > **Upload files**.
4. Arrastra **todos los archivos de esta carpeta** (index.html, style.css, app.js, README.md) al área de subida.
5. Pulsa el botón verde **Commit changes**.

### Activar la Página Web (GitHub Pages)

Una vez subidos los archivos:

1. Ve a la pestaña **Settings** (Configuración) de tu repositorio.
2. En el menú de la izquierda, busca **Pages**.
3. En "Branch", selecciona `main` (o `master`) y carpeta `/(root)`.
4. Dale a **Save**.
5. Espera unos minutos y GitHub te dará un enlace (ej. `https://usuario.github.io/novapack-webapp`). ¡Esa es tu web pública!
