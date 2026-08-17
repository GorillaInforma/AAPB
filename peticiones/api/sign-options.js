// api/sign-options.js
// Esto es lo que se usa CADA VEZ que el usuario firma algo. No crea ni pide crear
// ningún passkey nuevo: solo le pide al teléfono "verifica con el passkey que ya existe".
//
// El truco para que sea una "firma de documento" y no solo un login:
// el challenge que le mandamos al teléfono no es un número aleatorio cualquiera,
// es el hash del documento (combinado con un nonce para que nunca se repita).
// Así, la firma que regresa el teléfono queda matemáticamente ligada a ESE documento.
const { generateAuthenticationOptions } = require('@simplewebauthn/server');
const { db } = require('../lib/firebaseAdmin');
const crypto = require('crypto');
const { RP_ID } = require('../lib/rp');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const { username, documentHash } = req.body || {};
  if (!username || !documentHash) {
    return res.status(400).json({ error: 'faltan username o documentHash' });
  }

  const userDocId = username.toLowerCase().trim();
  const userRef = db.collection('users').doc(userDocId);
  const userSnap = await userRef.get();

  if (!userSnap.exists || !(userSnap.data().credentials || []).length) {
    return res.status(400).json({ error: 'este usuario no tiene passkey creado todavía' });
  }

  const credentials = userSnap.data().credentials;

  // nonce evita que la misma firma se pueda "reciclar" para otro documento idéntico
  const nonce = crypto.randomBytes(16).toString('hex');
  const challenge = crypto
    .createHash('sha256')
    .update(documentHash + nonce)
    .digest('base64url');

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: 'required',
    challenge,
    allowCredentials: credentials.map((c) => ({
      id: c.credentialID,
      transports: c.transports,
    })),
  });

  // transactionId para poder recuperar el documentHash + nonce en el paso de verificación
  const transactionId = crypto.randomUUID();
  await db.collection('pendingSignatures').doc(transactionId).set({
    userDocId,
    documentHash,
    nonce,
    challenge: options.challenge,
    createdAt: new Date().toISOString(),
  });

  return res.status(200).json({ options, transactionId });
};
