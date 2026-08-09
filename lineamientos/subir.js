// api/subir.js
// Función serverless (Vercel). El GITHUB_TOKEN vive SOLO aquí, como variable
// de entorno del proyecto en Vercel — nunca se envía al navegador.
// El cliente solo llama a esta función con: { carpeta, html, titulo, clave }

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  // --- Gate de acceso a la app (no es el token de GitHub, solo evita que
  //     alguien que encuentre la URL pueda escribir en tu repo) ---
  const clavePermitida = process.env.AAPB_ACCESS_KEY;
  const claveRecibida = req.headers['x-aapb-key'];
  if (clavePermitida && claveRecibida !== clavePermitida) {
    res.status(401).json({ error: 'Clave de acceso inválida' });
    return;
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    res.status(500).json({ error: 'GITHUB_TOKEN no está configurado en Vercel' });
    return;
  }

  const owner = process.env.GITHUB_OWNER || 'GorillaInforma';
  const repo = process.env.GITHUB_REPO || 'AAPB';
  const carpetaOrigenImagenes = 'lineamientos';

  const { carpeta, html, titulo } = req.body || {};
  if (!carpeta || !html) {
    res.status(400).json({ error: 'Falta carpeta o html en la solicitud' });
    return;
  }

  const API = 'https://api.github.com';

  async function gh(path, options = {}) {
    return fetch(API + path, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
  }

  async function obtenerSha(pathEnRepo, branch) {
    const r = await gh(`/repos/${owner}/${repo}/contents/${pathEnRepo}?ref=${encodeURIComponent(branch)}`);
    if (r.status === 200) {
      const d = await r.json();
      return d.sha || null;
    }
    return null;
  }

  async function subirArchivo(pathEnRepo, contenidoBase64, branch, mensaje) {
    const sha = await obtenerSha(pathEnRepo, branch);
    const body = { message: mensaje, content: contenidoBase64, branch };
    if (sha) body.sha = sha;
    const r = await gh(`/repos/${owner}/${repo}/contents/${pathEnRepo}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(`No se pudo subir ${pathEnRepo}: ${err.message || r.status}`);
    }
    return r.json();
  }

  try {
    const repoResp = await gh(`/repos/${owner}/${repo}`);
    if (!repoResp.ok) {
      throw new Error(
        repoResp.status === 404
          ? `No encontré el repositorio ${owner}/${repo} (revisa el token o el nombre).`
          : `Error al leer el repositorio (${repoResp.status}).`
      );
    }
    const repoData = await repoResp.json();
    const branch = repoData.default_branch || 'main';

    // Clonar imágenes de "lineamientos" hacia la carpeta destino (si es distinta)
    if (carpeta !== carpetaOrigenImagenes) {
      const listaResp = await gh(`/repos/${owner}/${repo}/contents/${carpetaOrigenImagenes}?ref=${encodeURIComponent(branch)}`);
      if (listaResp.ok) {
        const items = await listaResp.json();
        const archivos = Array.isArray(items) ? items.filter((it) => it.type === 'file') : [];
        for (const archivo of archivos) {
          const contenidoResp = await gh(
            `/repos/${owner}/${repo}/contents/${carpetaOrigenImagenes}/${encodeURIComponent(archivo.name)}?ref=${encodeURIComponent(branch)}`
          );
          if (!contenidoResp.ok) continue;
          const contenidoData = await contenidoResp.json();
          if (!contenidoData.content) continue;
          await subirArchivo(
            `${carpeta}/${archivo.name}`,
            contenidoData.content,
            branch,
            `Clonar ${archivo.name} desde ${carpetaOrigenImagenes}`
          );
        }
      } else if (listaResp.status !== 404) {
        throw new Error(`No se pudo leer la carpeta "${carpetaOrigenImagenes}": ${listaResp.status}`);
      }
    }

    // Subir el documento HTML estático
    const htmlBase64 = Buffer.from(html, 'utf-8').toString('base64');
    await subirArchivo(`${carpeta}/index.html`, htmlBase64, branch, `Publicar documento: ${titulo || 'sin título'}`);

    res.status(200).json({ ok: true, carpeta, branch });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error desconocido' });
  }
};
