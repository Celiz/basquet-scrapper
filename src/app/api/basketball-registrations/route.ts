// This file should be saved as: app/api/basketball-registrations/route.ts
import { list } from "@vercel/blob";
import { BLOB_FILENAME } from "../../lib/basketball-scraper";

// GET method to retrieve the latest basketball registrations
export async function GET() {
    try {
        // List blobs to find the most recent basketball registrations file
        const { blobs } = await list();
        const regBlob = blobs.find((blob: { pathname: string; }) => blob.pathname === BLOB_FILENAME);
        
        if (!regBlob) {
            return new Response(JSON.stringify({ error: 'No data found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Fetch the data from the URL
        const response = await fetch(regBlob.url);
        const data = await response.text();

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