# Cómo desplegar Novapack (Multipuesto / Nube)

Para que la aplicación sea accesible desde cualquier ordenador y lugar, debes subir estos archivos a un servicio de hosting web.

Como tu aplicación ya usa **Firebase** para la base de datos, ¡lo más fácil es usar **Firebase Hosting**! Es gratuito y muy rápido.

## Pasos para desplegar:

### 1. Preparar Firebase Tools (Solo se hace una vez)
Abre tu terminal (PowerShell o CMD) en esta carpeta y ejecuta:

```bash
npm install -g firebase-tools
```

### 2. Iniciar sesión en Google
Ejecuta:
```bash
firebase login
```
Se abrirá el navegador para que entres con tu cuenta de Google (la misma donde creaste el proyecto de Firebase).

### 3. Inicializar el proyecto
Ejecuta:
```bash
firebase init hosting
```
- Cuando te pregunte: "Are you ready to proceed?" -> Escribe **Y**.
- "Please select an option": Selecciona **Use an existing project**.
- Selecciona tu proyecto de Novapack de la lista.
- "What do you want to use as your public directory?": Escribe **.** (un punto, para indicar la carpeta actual).
- "Configure as a single-page app?": Escribe **N**.
- "Set up automatic builds...?": Escribe **N**.

### 4. Subir a Internet
Ejecuta:
```bash
firebase deploy
```

¡Listo! La terminal te dará una URL (ejemplo: `https://novapack-app.web.app`).
Ahora puedes entrar a esa dirección desde **cualquier ordenador o móvil**, iniciar sesión con tu usuario, ¡y verás los mismos datos en tiempo real!
