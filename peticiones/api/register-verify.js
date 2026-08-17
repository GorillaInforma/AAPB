// api/register-verify.js
// Paso 2 de "crear passkey": el teléfono ya respondió al reto usando huella/Face ID/PIN.
// Aquí se valida criptográficamente esa respuesta y se guarda solo la LLAVE PÚBLICA
// (nunca hay datos biométricos ni llave privada involucrados: esos nunca salen del teléfono).
const { verifyRegistrationResponse } = require('@simplewebauthn/server');
const { admin, db } = require('../lib/firebaseAdmin');
const { RP_ID, ORIGIN } = require('../lib/rp');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const { username, response } = req.body || {};
  if (!username || !response) return res.status(400).json({ error: 'faltan datos' });

  const userDocId = username.toLowerCase().trim();
  const userRef = db.collection('users').doc(userDocId);
  const userSnap = await userRef.get();

  if (!userSnap.exists || !userSnap.data().currentChallenge) {
    return res.status(400).json({ error: 'no hay un registro en curso para este usuario' });
  }

  const expectedChallenge = userSnap.data().currentChallenge;

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
    });
  } catch (err) {
    return res.status(400).json({ error: 'verificación falló: ' + err.message });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return res.status(400).json({ error: 'la firma del passkey no es válida' });
  }

  const { credential } = verification.registrationInfo;

  const newCredential = {
    credentialID: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString('base64url'),
    counter: credential.counter,
    transports: response.response.transports || [],
    createdAt: new Date().toISOString(),
  };

  const existingCredentials = userSnap.data().credentials || [];

  await userRef.set(
    {
      credentials: [...existingCredentials, newCredential],
      currentChallenge: admin.firestore.FieldValue.delete(),
    },
    { merge: true }
  );

  return res.status(200).json({ verified: true });
};
