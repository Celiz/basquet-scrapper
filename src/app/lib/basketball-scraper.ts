// This file should be saved as: app/lib/basketball-scraper.ts
import puppeteer from 'puppeteer';
import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';
import { put, list } from "@vercel/blob";

// Load environment variables
dotenv.config();

// TypeScript interfaces
interface BasketballRegistration {
    polideportivo: string;
    categoria: string;
    actividad: string;
    subcategoria: string;
    horario: string;
}

interface RegistrationData {
    timestamp: string;
    registrations: BasketballRegistration[];
}

// Constants
export const BLOB_FILENAME = 'basketball-registrations.json';
export const SCRAPE_INTERVAL_HOURS = 6;
export const URL = 'https://appsb.mardelplata.gob.ar/Consultas/nPolideportivos/Vistas/Inscripciones/InscripcionWeb/InscripcionWeb.aspx';

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

export class BasketballRegistrationScraper {
    public async saveData(registrations: BasketballRegistration[]): Promise<string> {
        try {
            const data: RegistrationData = {
                timestamp: new Date().toISOString(),
                registrations
            };

            // Save data to Vercel Blob storage
            const { url } = await put(BLOB_FILENAME, JSON.stringify(data, null, 2), {
                access: 'public',
                contentType: 'application/json'
            });

            console.log(`✓ Data saved successfully to ${url}`);
            return url;
        } catch (error) {
            console.error('✗ Error saving data:', error);
            throw error;
        }
    }

    private async sendEmail(registrations: BasketballRegistration[], blobUrl?: string): Promise<void> {
        if (!process.env.RECIPIENT_EMAIL || !process.env.FROM_EMAIL) {
            console.error('✗ Missing email configuration');
            return;
        }

        let htmlContent: string;

        if (registrations.length > 0) {
            const tableRows = registrations.map(item => `
      <tr style="border-bottom: 1px solid #e0e0e0;">
        <td style="padding: 12px; text-align: left;">${item.polideportivo}</td>
        <td style="padding: 12px; text-align: left;">${item.categoria}</td>
        <td style="padding: 12px; text-align: left;">${item.actividad}</td>
        <td style="padding: 12px; text-align: left;">${item.subcategoria}</td>
        <td style="padding: 12px; text-align: left;">${item.horario}</td>
      </tr>
    `).join('');

            htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Inscripciones Básquet</title>
      </head>
      <body style="font-family: 'Arial', sans-serif; margin: 0; padding: 20px; background-color: #f7f7f7;">
        <div style="max-width: 800px; margin: 0 auto; background-color: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <!-- Header -->
          <div style="background-color: #2c3e50; padding: 25px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px; display: flex; align-items: center; gap: 10px;">
              🏀 Inscripciones Disponibles
            </h1>
          </div>

          <!-- Content -->
          <div style="padding: 25px;">
            <p style="color: #666; margin-bottom: 25px; font-size: 15px;">
              Se encontraron <strong>${registrations.length} inscripciones</strong> disponibles 
              para básquet. Fecha de consulta: ${new Date().toLocaleDateString('es-AR')}
            </p>

            <!-- Table -->
            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
                <thead>
                  <tr style="background-color: #f8f9fa; color: #2c3e50;">
                    <th style="padding: 15px; text-align: left; min-width: 150px;">Polideportivo</th>
                    <th style="padding: 15px; text-align: left;">Categoría</th>
                    <th style="padding: 15px; text-align: left;">Actividad</th>
                    <th style="padding: 15px; text-align: left;">Subcategoría</th>
                    <th style="padding: 15px; text-align: left;">Horario</th>
                  </tr>
                </thead>
                <tbody>
                  ${tableRows}
                </tbody>
              </table>
            </div>

            <!-- Footer -->
            <div style="border-top: 1px solid #eee; padding-top: 20px; color: #666; font-size: 14px;">
              <p style="margin: 5px 0;">📅 Actualizado automáticamente cada ${SCRAPE_INTERVAL_HOURS} horas</p>
              <p style="margin: 5px 0;">⚠️ Este es un mensaje automático, por favor no responder</p>
              ${blobUrl ? `<p style="margin: 5px 0;">🔗 <a href="${blobUrl}">Ver datos en formato JSON</a></p>` : ''}
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
        } else {
            htmlContent = `
      <div style="max-width: 600px; margin: 0 auto; padding: 30px; background-color: #fff3cd; border-radius: 8px; text-align: center;">
        <h2 style="color: #856404; margin-top: 0;">⚠️ No hay inscripciones disponibles</h2>
        <p style="color: #856404;">No se encontraron inscripciones de básquet en este momento.</p>
        <p style="color: #856404;">Prueba nuevamente más tarde o verifica directamente en el sitio.</p>
      </div>
    `;
        }

        const msg = {
            to: process.env.RECIPIENT_EMAIL,
            from: process.env.FROM_EMAIL,
            subject: `🏀 ${registrations.length > 0 ? 'Nuevas Inscripciones Disponibles!' : 'Sin inscripciones disponibles'}`,
            html: htmlContent,
        };

        try {
            await sgMail.send(msg);
            console.log('✓ Email sent successfully');
        } catch (error) {
            console.error('✗ Error sending email:', error);
            throw error;
        }
    }

    public async scrape(): Promise<void> {
        console.log('\n=== Starting scraping process ===');
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });

        let page;

        try {
            page = await browser.newPage();
            console.log('▸ Browser initialized');

            // Step 1: Navigate to the page
            console.log('▸ Navigating to page...');
            await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
            console.log('✓ Page loaded');

            // Step 2: Select search by category
            console.log('▸ Selecting "Por Categoría"...');
            await page.evaluate(() => {
                const radioButton = document.querySelector('#MainContent_TipoBusqueda_1') as HTMLInputElement;
                if (radioButton) radioButton.click();
            });
            await new Promise(resolve => setTimeout(resolve, 3000));
            console.log('✓ Option selected');

            // Step 3: Select DEPORTE category
            console.log('▸ Selecting DEPORTE category...');
            await page.select('#MainContent_ddlCategoria', '1');
            await new Promise(resolve => setTimeout(resolve, 3000));
            console.log('✓ Category selected');

            // Step 4: Select BASQUET activity
            console.log('▸ Selecting BASQUET activity...');
            await page.select('#MainContent_ddlActividad', '16');
            await new Promise(resolve => setTimeout(resolve, 3000));
            console.log('✓ Activity selected');

            // Step 5: Click Search button
            console.log('▸ Clicking Search button...');
            await Promise.all([
                page.click('#MainContent_btnBuscarCat'),
                page.waitForNavigation({ waitUntil: 'networkidle2' })
            ]);
            console.log('✓ Search performed');

            // Step 6: Wait for results and extract data
            console.log('▸ Looking for results...');
            await page.waitForSelector('#MainContent_gvBuscarActXCat', { timeout: 10000 });
            console.log('✓ Results table found');

            const registrations: BasketballRegistration[] = await page.evaluate(() => {
                const rows = Array.from(document.querySelectorAll('#MainContent_gvBuscarActXCat tr:not(:first-child)'));
                return rows.map(row => {
                    const cols = row.querySelectorAll('td');
                    return {
                        polideportivo: cols[1]?.textContent?.trim() || '',
                        categoria: cols[2]?.textContent?.trim() || '',
                        actividad: cols[3]?.textContent?.trim() || '',
                        subcategoria: cols[4]?.textContent?.trim() || '',
                        horario: cols[5]?.textContent?.trim() || ''
                    };
                });
            });

            console.log('\n=== RESULTS FOUND ===');
            console.log(`▸ Total registrations: ${registrations.length}`);
            console.table(registrations);

            // Step 7: Save data and send email
            const blobUrl = await this.saveData(registrations);
            await this.sendEmail(registrations, blobUrl);

        } catch (error) {
            console.error('\n=== ERROR ===');
            console.error(`✗ Error during process: ${error instanceof Error ? error.message : String(error)}`);

            // Take screenshot in case of error
            if (page) {
                // Save screenshot to Vercel Blob
                try {
                    const screenshot = await page.screenshot();
                    const { url } = await put('error-screenshot.png', Buffer.from(screenshot), { 
                        access: 'public',
                        contentType: 'image/png'
                    });
                    console.log(`▸ Error screenshot saved to ${url}`);
                } catch (screenshotError) {
                    console.error('✗ Error saving screenshot:', screenshotError);
                }

                await this.sendEmail([]);
            }
        } finally {
            await browser.close();
            console.log('\n=== Process completed ===');
            console.log('▸ Browser closed');
        }
    }

    public async start(): Promise<void> {
        // Run immediately
        await this.scrape();

        // Schedule runs
        setInterval(() => this.scrape(), SCRAPE_INTERVAL_HOURS * 60 * 60 * 1000);
        console.log(`Scheduled to run every ${SCRAPE_INTERVAL_HOURS} hours`);
    }
}