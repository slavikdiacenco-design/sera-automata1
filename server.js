const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS senzori (
      id SERIAL PRIMARY KEY,
      temperatura FLOAT,
      umiditate FLOAT,
      sol1 INT,
      sol2 INT,
      ptc BOOLEAN,
      fan BOOLEAN,
      pompa BOOLEAN,
      creat_la TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS comenzi (
      id SERIAL PRIMARY KEY,
      actuator VARCHAR(20),
      stare BOOLEAN,
      executat BOOLEAN DEFAULT FALSE,
      creat_la TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('Baza de date initializata!');
}

app.post('/api/date', async (req, res) => {
  const { temperatura, umiditate, sol1, sol2, ptc, fan, pompa } = req.body;
  try {
    await pool.query(
      `INSERT INTO senzori
       (temperatura, umiditate, sol1, sol2, ptc, fan, pompa)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [temperatura, umiditate, sol1, sol2, ptc, fan, pompa]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ eroare: err.message });
  }
});

app.get('/api/curent', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM senzori ORDER BY creat_la DESC LIMIT 1`
    );
    res.json(result.rows[0] || {});
  } catch (err) {
    res.status(500).json({ eroare: err.message });
  }
});

app.get('/api/istoric', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM senzori
       WHERE creat_la > NOW() - INTERVAL '24 hours'
       ORDER BY creat_la ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ eroare: err.message });
  }
});

app.post('/api/comanda', async (req, res) => {
  const { actuator, stare } = req.body;
  try {
    await pool.query(
      `INSERT INTO comenzi (actuator, stare) VALUES ($1, $2)`,
      [actuator, stare]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ eroare: err.message });
  }
});

app.get('/api/comenzi', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM comenzi WHERE executat = FALSE ORDER BY creat_la ASC`
    );
    await pool.query(
      `UPDATE comenzi SET executat = TRUE WHERE executat = FALSE`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ eroare: err.message });
  }
});

const PORT = process.env.PORT || 3000;
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server pornit pe portul ${PORT}`);
  });
});