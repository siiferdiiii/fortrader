require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

async function testQuery() {
    try {
        const sql = neon(process.env.DATABASE_URL);
        
        // Check subscriptions table structure
        console.log("--- TABLE STRUCTURE: subscriptions ---");
        const columns = await sql`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'subscriptions'
        `;
        console.table(columns);

        // Check if there are any errors doing a raw mock insert 
        // We will insert a dummy and rollback right away (Neon serverless HTTP driver doesn't support transactions easily, so we just run a query that we know will fail if columns are wrong)
        
        console.log("\n--- ERRORS CHECK ---");
        
        // This is a test query mimicking the callback.js
        console.log("If there's a column mismatch, the error will show below:");
        
        // We do a SELECT with the exact column names we use in our INSERT
        await sql`
            SELECT id, user_id, plan, status, current_period_start, current_period_end 
            FROM subscriptions LIMIT 1
        `;
        
        console.log("SUCCESS: All columns exist!");
        
    } catch (err) {
        console.error("DATABASE ERROR FOUND:");
        console.error(err.message);
    }
}

testQuery();
