import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const dbLokal = createClient({ url: 'file:data/portfolio.db' });
const dbTurso = createClient({ 
  url: process.env.DATABASE_URL, 
  authToken: process.env.DATABASE_AUTH_TOKEN 
});

async function migrasi() {
  const tabel = ['pengguna', 'kategori', 'karya', 'layanan', 'pengalaman', 'skill', 'logo', 'menu', 'profil', 'pesan'];
  
  for (const t of tabel) {
    console.log(`Mengambil data ${t}...`);
    const data = await dbLokal.execute(`SELECT * FROM ${t}`);
    if (data.rows.length === 0) continue;
    
    // Hapus data di Turso
    await dbTurso.execute(`DELETE FROM ${t}`);
    
    // Insert data ke Turso
    const kolom = data.columns.join(', ');
    const placeholders = data.columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${t} (${kolom}) VALUES (${placeholders})`;
    
    console.log(`Menulis ${data.rows.length} baris ke ${t} di Turso...`);
    for (const row of data.rows) {
      const args = data.columns.map(c => row[c]);
      await dbTurso.execute({ sql, args });
    }
  }
  console.log('Selesai!');
}

migrasi().catch(console.error);
