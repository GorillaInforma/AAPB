import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const CANVA_URL = 'https://canva.link/bx1oowcd80x9msl';

export default async function handler(req, res) {
  let browser;

  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    // Simular navegador real para que Canva no bloquee
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/120.0.0.0 Safari/537.36'
    );

    // Esperar a que Canva cargue completamente
    await page.goto(CANVA_URL, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    // Dar tiempo extra para animaciones/fuentes de Canva
    await new Promise(r => setTimeout(r, 3000));

    // Generar PDF
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="documento.pdf"');
    res.setHeader('Cache-Control', 'no-store');
    res.send(pdf);

  } catch (err) {
    console.error('Error generando PDF:', err);
    res.status(500).json({ error: 'No se pudo generar el PDF', detalle: err.message });

  } finally {
    if (browser) await browser.close();
  }
}
