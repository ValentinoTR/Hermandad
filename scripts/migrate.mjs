import {readFile} from 'node:fs/promises';
import postgres from 'postgres';
if(!process.env.MIGRATION_DATABASE_URL)throw new Error('Configura MIGRATION_DATABASE_URL con una cuenta administradora para crear el esquema inicial.');
const sql=postgres(process.env.MIGRATION_DATABASE_URL,{prepare:false,max:1,ssl:'require'});
try{
 await sql.begin(async tx=>{
  const [row]=await tx`select to_regnamespace('hsmi') is not null as exists`;
  if(row.exists)throw new Error('hsmi ya existe. Esta instalación inicial no modifica esquemas existentes.');
  await tx.unsafe(await readFile(new URL('../database/hsmi.sql',import.meta.url),'utf8'));
  await tx.unsafe(await readFile(new URL('../database/receipt-numbers.sql',import.meta.url),'utf8'));
 });
 console.log('Esquema HSMI creado. Configura el acceso privado hsmi_app desde la administración de Supabase.');
}finally{await sql.end();}
