// lib/rp.js
// Config del "Relying Party" (tu app). El rpID debe ser el dominio pelón (sin https://, sin puerto),
// ej: "mi-demo.vercel.app" o "midominio.com". En localhost usa "localhost".
// IMPORTANTE: si cambias el rpID después de que la gente ya creó passkeys, esos passkeys dejan de servir.

const RP_NAME = 'Firma Passkey Demo';
const RP_ID = process.env.RP_ID || 'localhost';
const ORIGIN = process.env.APP_ORIGIN || 'http://localhost:3000';

module.exports = { RP_NAME, RP_ID, ORIGIN };
