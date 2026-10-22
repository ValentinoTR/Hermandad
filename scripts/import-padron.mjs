import {readFile} from 'node:fs/promises';
import postgres from 'postgres';
const file=process.argv[2];
if(!file||!process.env.DATABASE_URL)throw new Error('Usa DATABASE_URL y npm run db:import -- /ruta/respaldo.json');
const b=JSON.parse(await readFile(file,'utf8'));
if(b.format!=='hsmi-backup-v1'||!Array.isArray(b.members)||!Array.isArray(b.concepts)||!Array.isArray(b.audit))throw new Error('Respaldo no válido.');
const defs={members:['id','name','group_name','data','revision','last_mutation'],concepts:['id','year','name','amount'],audit:['id','at','actor','action','member_id','detail'],settings:['key','value']};
for(const m of b.members){const data=JSON.parse(m.data);if(!m.id||!m.name||!data.obligations||!Array.isArray(data.payments))throw new Error('Integrante no válido.');}
b.settings=(b.settings||[]).filter(s=>s.key==='import');
const sql=postgres(process.env.DATABASE_URL,{prepare:false,max:1,ssl:'require'});
try{
 await sql.begin(async tx=>{
  const [{count}]=await tx`select count(*)::int as count from hsmi.members`;
  if(count)throw new Error('La base ya tiene integrantes. No se sobrescriben datos: revisa el respaldo antes de importar.');
  for(const [table,columns] of Object.entries(defs)){
   for(let i=0;i<b[table].length;i+=50){
    const rows=b[table].slice(i,i+50).map(r=>Object.fromEntries(columns.map(c=>[c,r[c]??(c==='last_mutation'?'':null)])));
    if(rows.length)await tx`insert into ${tx('hsmi.'+table)} ${tx(rows,columns)}`;
   }
  }
 });
 console.log(`Importados ${b.members.length} integrantes y ${b.concepts.length} conceptos. No se importan contraseñas ni sesiones.`);
}finally{await sql.end();}
