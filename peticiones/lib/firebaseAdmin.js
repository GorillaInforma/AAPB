// lib/firebaseAdmin.js
// Inicializa Firebase Admin SDK una sola vez (patrón singleton para funciones serverless).
// Requiere 3 variables de entorno en Vercel (sacadas del JSON de tu cuenta de servicio de Firebase):
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY   (pega el valor completo; Vercel guarda los \n como texto, por eso el replace de abajo)

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

module.exports = { admin, db };
