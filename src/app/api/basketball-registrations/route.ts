import puppeteer from 'puppeteer';
import sgMail from '@sendgrid/mail';
import { promises as fs } from 'fs';
import path from 'path';
import dotenv from 'dotenv';

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
const DATA_FILE_PATH = path.join('public', 'data', 'basketball-registrations.json');
const SCRAPE_INTERVAL_HOURS = 6;
const URL = 'https://appsb.mardelplata.gob.ar/Consultas/nPolideportivos/Vistas/Inscripciones/InscripcionWeb/InscripcionWeb.aspx';

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

class BasketballRegistrationScraper {
  private async saveData(registrations: BasketballRegistration[]): Promise<void> {
    try {
      await fs.mkdir(path.dirname(DATA_FILE_PATH), { recursive: true });
      
      const data: RegistrationData = {
        timestamp: new Date().toISOString(),
        registrations
      };
      
      await fs.writeFile(DATA_FILE_PATH, JSON.stringify(data, null, 2));
      console.log('✓ Data saved successfully');
    } catch (error) {
      console.error('✗ Error saving data:', error);
      throw error;
    }
  }

  private async sendEmail(registrations: BasketballRegistration[]): Promise<void> {
    if (!process.env.RECIPIENT_EMAIL || !process.env.FROM_EMAIL) {
      console.error('✗ Missing email configuration');
      return;
    }

    let htmlContent: string;
    
    if (registrations.length > 0) {
      const tableRows = registrations.map(item => `
        <tr>
          <td>${item.polideportivo}</td>
          <td>${item.categoria}</td>
          <td>${item.actividad}</td>
          <td>${item.subcategoria}</td>
          <td>${item.horario}</td>
        </tr>
      `).join('');

      htmlContent = `
        <h2>Inscripciones disponibles para Básquet</h2>
        <p>Fecha de consulta: ${new Date().toLocaleString()}</p>
        <table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%;">
          <tr style="background-color: #f2f2f2;">
            <th>Polideportivo</th>
            <th>Categoría</th>
            <th>Actividad</th>
            <th>Subcategoría</th>
            <th>Horario</th>
          </tr>
          ${tableRows}
        </table>
      `;
    } else {
      htmlContent = '<p>No se encontraron inscripciones disponibles</p>';
    }

    const msg = {
      to: process.env.RECIPIENT_EMAIL,
      from: process.env.FROM_EMAIL,
      subject: 'Notificación de Inscripciones de Básquet',
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
      await this.saveData(registrations);
      await this.sendEmail(registrations);

    } catch (error) {
      console.error('\n=== ERROR ===');
      console.error(`✗ Error during process: ${error instanceof Error ? error.message : String(error)}`);
      
      // Take screenshot in case of error
      if (page) {
        await page.screenshot({ path: 'error-screenshot.png' });
        console.log('▸ Error screenshot saved as error-screenshot.png');
        
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

// Run the scraper
const scraper = new BasketballRegistrationScraper();
scraper.start().catch(console.error);


// GET method to retrieve the latest basketball registrations
export async function GET() {
    try {
        const data = await fs.readFile(DATA_FILE_PATH, 'utf-8');
        return new Response(data, {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to fetch data' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}