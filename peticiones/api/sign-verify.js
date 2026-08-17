// api/sign-verify.js
// Verifica que la respuesta del passkey efectivamente firmó el challenge que
// generamos en sign-options.js (el cual está ligado al hash del documento).
// Si es válida, se guarda un comprobante y se entrega un token de sesión de Firebase.
const { verifyAuthenticationResponse } = require('@simplewebauthn/server');
const { admin, db } = require('../lib/firebaseAdmin');
const { RP_ID, ORIGIN } = require('../lib/rp');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const { transactionId, response } = req.body || {};
  if (!transactionId || !response) return res.status(400).json({ error: 'faltan datos' });

  const pendingRef = db.collection('pendingSignatures').doc(transactionId);
  const pendingSnap = await pendingRef.get();
  if (!pendingSnap.exists) {
    return res.status(400).json({ error: 'transacción no encontrada o ya usada' });
  }
  const pending = pendingSnap.data();

  const userRef = db.collection('users').doc(pending.userDocId);
  const userSnap = await userRef.get();
  const credentials = userSnap.data().credentials || [];

  const matching = credentials.find((c) => c.credentialID === response.id);
  if (!matching) {
    return res.status(400).json({ error: 'este passkey no pertenece al usuario' });
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: pending.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
      credential: {
        id: matching.credentialID,
        publicKey: Buffer.from(matching.publicKey, 'base64url'),
        counter: matching.counter,
        transports: matching.transports,
      },
    });
  } catch (err) {
    return res.status(400).json({ error: 'verificación falló: ' + err.message });
  }

  if (!verification.verified) {
    return res.status(400).json({ error: 'la firma no es válida' });
  }

  // Actualiza el contador anti-clonación (counter) de este passkey
  const updatedCredentials = credentials.map((c) =>
    c.credentialID === matching.credentialID
      ? { ...c, counter: verification.authenticationInfo.newCounter }
      : c
  );
  await userRef.set({ credentials: updatedCredentials }, { merge: true });

  // Comprobante permanente de la firma: esto es lo que le muestras al usuario
  // o guardas junto al contrato como evidencia.
  const signatureRecord = {
    userDocId: pending.userDocId,
    documentHash: pending.documentHash,
    credentialID: matching.credentialID,
    verifiedAt: new Date().toISOString(),
  };
  await db.collection('signedDocuments').doc(transactionId).set(signatureRecord);
  await pendingRef.delete();

  // Token de sesión de Firebase: prueba de que este usuario quedó autenticado
  // en este momento mediante su passkey (útil si luego quieres reglas de
  // seguridad de Firestore/Storage basadas en request.auth.uid).
  const customToken = await admin.auth().createCustomToken(pending.userDocId);

  return res.status(200).json({ verified: true, signatureRecord, customToken });
};
