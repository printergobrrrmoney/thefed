import { neon } from '@neondatabase/serverless';

/**
 * One connection helper. Neon's serverless driver talks over HTTP, so there is
 * no pool to manage across function invocations.
 */
let client = null;

export const db = () => {
    if (!client) {
        const url = process.env.DATABASE_URL;
        if (!url) throw new Error('DATABASE_URL is not set');
        client = neon(url);
    }
    return client;
};
