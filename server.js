const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

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
    CREATE TABLE IF NOT EXISTS control (
      id INT PRIMARY KEY DEFAULT 1,
      mod_manual BOOLEAN DEFAULT FALSE,
      ptc BOOLEAN DEFAULT FALSE,
      fan BOOLEAN DEFAULT FALSE,
      pompa BOOLEAN DEFAULT FALSE,
      actualizat_la TIMESTAMP DEFAULT NOW()
    )
  `);
  // Inserezi un singur rand de control daca nu exista
  await pool.query(`
    INSERT INTO control (id, mod_manual, ptc, fan, pompa)
    VALUES (1, FALSE, FALSE, FALSE, FALSE)
    ON CONFLICT (id) DO NOTHING
  `);
  console.log('Baza de date initializata!');
}

// ESP32 trimite date senzori
app.post('/api/date', async (req, res) => {
  const { temperatura, umiditate, sol1, sol2, ptc, fan, pompa } = req.body;
  try {
    await pool.query(
      `INSERT INTO senzori (temperatura, umiditate, sol1, sol2, ptc, fan, pompa)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [temperatura, umiditate, sol1, sol2, ptc, fan, pompa]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ eroare: err.message });
  }
});

// Browser citeste ultima valoare
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

// Browser citeste istoricul 24h
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

// Browser trimite starea completa a controlului
app.post('/api/control', async (req, res) => {
  const { mod_manual, ptc, fan, pompa } = req.body;
  try {
    await pool.query(
      `UPDATE control SET
       mod_manual = $1, ptc = $2, fan = $3, pompa = $4,
       actualizat_la = NOW()
       WHERE id = 1`,
      [mod_manual, ptc, fan, pompa]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ eroare: err.message });
  }
});

// ESP32 citeste starea controlului
app.get('/api/control', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM control WHERE id = 1`
    );
    res.json(result.rows[0] || {});
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