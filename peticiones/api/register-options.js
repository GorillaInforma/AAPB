// api/register-options.js
// Paso 1 de "crear passkey": el servidor genera un reto (challenge) aleatorio
// y le dice al navegador qué tipo de llave pedirle al teléfono.
const { generateRegistrationOptions } = require('@simplewebauthn/server');
const { db } = require('../lib/firebaseAdmin');
const { RP_NAME, RP_ID } = require('../lib/rp');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const { username } = req.body || {};
  if (!username || typeof username !== 'string' || username.length < 3) {
    return res.status(400).json({ error: 'username inválido (mínimo 3 caracteres)' });
  }

  const userDocId = username.toLowerCase().trim();
  const userRef = db.collection('users').doc(userDocId);
  const userSnap = await userRef.get();

  // Si el usuario ya tiene passkeys, se los excluimos de la lista para que el
  // teléfono no ofrezca "crear otro" si ya existe uno en este dispositivo.
  const existingCredentials = userSnap.exists ? (userSnap.data().credentials || []) : [];

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: userDocId,
    // userID debe ser Uint8Array desde @simplewebauthn/server v10+
    userID: new TextEncoder().encode(userDocId),
    attestationType: 'none',
    excludeCredentials: existingCredentials.map((c) => ({
      id: c.credentialID,
      transports: c.transports,
    })),
    authenticatorSelection: {
      residentKey: 'required',       // passkey "descubrible" (aparece sin escribir username)
      userVerification: 'required',  // exige huella/Face ID/PIN, no solo "toca el sensor"
      authenticatorAttachment: 'platform', // usa el autenticador del propio teléfono
    },
  });

  // Guardamos el challenge temporalmente para poder verificarlo en el siguiente paso.
  await userRef.set(
    {
      currentChallenge: options.challenge,
      credentials: existingCredentials,
    },
    { merge: true }
  );

  return res.status(200).json(options);
};
