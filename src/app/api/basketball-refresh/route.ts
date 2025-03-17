// This file should be saved as: app/api/basketball-refresh/route.ts
import { BasketballRegistrationScraper } from '../../lib/basketball-scraper';

export async function GET() {
    try {
        console.log('Manual scrape initiated via API');
        const scraper = new BasketballRegistrationScraper();
        
        // Run the scrape but don't wait for it to complete in the request
        // This prevents timeout issues if scraping takes too long
        interface ScrapeResponse {
            status: 'success' | 'error';
            message: string;
        }

        interface BasketballScraper {
            scrape(): Promise<void>;
        }

                (scraper as BasketballScraper).scrape().catch((error: Error) => {
                    console.error('Error during manual scrape:', error);
                });

        return new Response(JSON.stringify({ 
            status: 'success',
            message: 'Basketball data refresh initiated'
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error triggering manual scrape:', error);
        return new Response(JSON.stringify({ 
            status: 'error',
            message: 'Failed to trigger basketball data refresh'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}