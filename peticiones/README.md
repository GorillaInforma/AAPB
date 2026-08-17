# Firma con Passkey + Firebase (demo)

Prototipo para aprender el patrón: **WebAuthn (passkey) para la verificación real** +
**Firebase para guardar datos y dar sesión**. Ningún dato biométrico sale nunca del teléfono;
el servidor solo ve llaves públicas y firmas criptográficas.

## Cómo está armado

```
public/index.html     ← UI (single-file, sin build step)
api/register-options.js  ← paso 1 de crear passkey
api/register-verify.js   ← paso 2 de crear passkey
api/sign-options.js      ← genera el reto de firma (ligado al hash del documento)
api/sign-verify.js       ← verifica la firma y da el comprobante + token de Firebase
lib/firebaseAdmin.js     ← conexión a Firestore desde el backend
lib/rp.js                ← config del dominio (rpID) y origin
firestore.rules          ← todo bloqueado del lado cliente; solo el backend escribe
```

`/api/*` funciona automático como Vercel Serverless Functions (Node) — no necesitas
configurar nada extra para que corran, solo hacer `vercel deploy`.

## 1. Firebase — sácale 2 cosas a tu proyecto existente

**a) Cuenta de servicio (para el backend/Admin SDK):**
Firebase Console → ⚙️ Configuración del proyecto → Cuentas de servicio → "Generar nueva
clave privada". Descarga el JSON: de ahí sacas `project_id`, `client_email` y
`private_key`.

**b) Config del cliente web (para el navegador):**
Firebase Console → ⚙️ Configuración del proyecto → Tus apps → si no tienes una app Web,
créala (ícono `</>`) → copia el objeto `firebaseConfig`.

Pega ese objeto en `public/index.html`, donde dice `TU_API_KEY` / `TU_PROYECTO`.

**c) Habilita Firestore** si no lo tienes activo (modo producción está bien, las
`firestore.rules` de este repo ya bloquean todo del lado cliente).

**d) Habilita el proveedor "Custom" en Firebase Authentication** (Authentication →
Sign-in method → asegúrate de que Authentication esté activado; el signInWithCustomToken
funciona por defecto una vez que Authentication está prendido, no requiere un proveedor
extra).

## 2. Variables de entorno en Vercel

En tu proyecto de Vercel → Settings → Environment Variables, agrega:

| Variable | Valor |
|---|---|
| `FIREBASE_PROJECT_ID` | del JSON de la cuenta de servicio |
| `FIREBASE_CLIENT_EMAIL` | del JSON de la cuenta de servicio |
| `FIREBASE_PRIVATE_KEY` | del JSON de la cuenta de servicio (pega el valor completo tal cual, con los `\n`) |
| `RP_ID` | el dominio pelón donde vivirá la app, ej. `mi-demo.vercel.app` (sin `https://`) |
| `APP_ORIGIN` | la URL completa, ej. `https://mi-demo.vercel.app` |

⚠️ **`RP_ID` no se puede cambiar después** sin invalidar todos los passkeys ya creados.
En local usa `RP_ID=localhost` y `APP_ORIGIN=http://localhost:3000`.

## 3. Instalar y desplegar

```bash
npm install
npx vercel deploy
```

(Termux funciona bien para esto: `npm install` y `npx vercel` corren igual que en
cualquier Linux.)

## 4. Probar

1. Abre la URL desplegada **en tu teléfono** (WebAuthn con `platform` authenticator
   necesita el dispositivo real, no funciona bien en un emulador de escritorio).
2. Escribe un nombre de usuario → "Crear passkey en este dispositivo" → te pide
   huella/Face ID/PIN → eso *crea* el passkey.
3. Edita o deja el texto del "documento" → "Firmar con passkey" → te vuelve a pedir
   huella/Face ID/PIN → eso *verifica*, no crea nada nuevo.
4. Si todo sale bien ves el sello ✓ y el comprobante (usuario, hash del documento,
   id de credencial, fecha) — eso es lo que guardarías junto al contrato como evidencia.

## Qué es demo y qué te falta para producción

Esto es un prototipo educativo, no un sistema de firma legal listo para usar:

- **`attestationType: 'none'`** — no se verifica la marca/modelo del autenticador.
  Para cumplimiento más estricto (ej. banca) normalmente se pide atestación.
- **No hay recuperación de cuenta** si el usuario pierde su único dispositivo con el
  passkey — en producción normalmente permites registrar 2+ passkeys por usuario.
- **`pendingSignatures` no expira** — en producción bórralos con un TTL (Firestore
  soporta "TTL policies") para que retos viejos no queden colgados.
- Si esto reemplaza la firma canvas de Alza, hay que sumarle **validez legal** —
  eso ya es tema de asesoría legal en México (firma electrónica avanzada vs. simple),
  no algo que resuelva el código.
