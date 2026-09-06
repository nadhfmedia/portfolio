import { v2 as cloudinary } from 'cloudinary';
import { createClient } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
dotenv.config();

cloudinary.config();

const dbTurso = createClient({ 
  url: process.env.DATABASE_URL, 
  authToken: process.env.DATABASE_AUTH_TOKEN 
});

async function main() {
  const dir = 'storage/uploads';
  const files = fs.readdirSync(dir).filter(f => !f.startsWith('.'));
  
  for (const f of files) {
    const fullPath = path.join(dir, f);
    const idDbAsli = 'uploads/' + f;
    
    console.log(`Mengupload ${f}...`);
    try {
      const result = await cloudinary.uploader.upload(fullPath, {
        folder: 'nadhiful-portfolio'
      });
      const urlBaru = result.secure_url;
      
      console.log(`Berhasil! URL baru: ${urlBaru}`);
      
      // Update semua tabel yang mungkin menyimpan gambar ini
      // karya, logo, profil (foto About), pengguna (foto)
      
      await dbTurso.execute({
        sql: `UPDATE karya SET gambar = ? WHERE gambar = ?`,
        args: [urlBaru, idDbAsli]
      });
      
      await dbTurso.execute({
        sql: `UPDATE logo SET gambar = ? WHERE gambar = ?`,
        args: [urlBaru, idDbAsli]
      });
      
      await dbTurso.execute({
        sql: `UPDATE profil SET nilai = ? WHERE nilai = ?`,
        args: [urlBaru, idDbAsli]
      });
      
      await dbTurso.execute({
        sql: `UPDATE pengguna SET foto = ? WHERE foto = ?`,
        args: [urlBaru, idDbAsli]
      });
      
    } catch (e) {
      console.error(`Gagal upload ${f}:`, e);
    }
  }
  
  console.log('Semua file lokal berhasil dipindah ke Cloudinary!');
}

main().catch(console.error);
