import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // force ssl with no verify
});

client.connect()
  .then(() => console.log('✅ Connected successfully!'))
  .catch(err => console.error('❌ Connection error:', err))
  .finally(() => client.end());