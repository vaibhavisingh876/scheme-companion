import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: "postgresql://postgres:EJ8JvqDbtYst0Lfg@db.xyxjdedtptnvhjnoebht.supabase.co:5432/postgres?sslmode=no-verify",
});

client.connect()
  .then(() => {
    console.log('✅ Connected!');
    return client.query('SELECT NOW()');
  })
  .then(res => {
    console.log('⏰ DB Time:', res.rows[0].now);
    client.end();
  })
  .catch(err => {
    console.error('❌ Connection error:', err.message);
    client.end();
  });