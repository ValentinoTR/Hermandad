import {getDatabase} from './database';
export async function importOriginal(_actor:string){
 const info=await getDatabase().prepare("SELECT value FROM settings WHERE key='import'").first<{value:string}>();
 if(info)return {ok:true,alreadyImported:true,count:JSON.parse(info.value).count};
 throw Object.assign(new Error('Importa el respaldo privado desde el servidor con npm run db:import. Los datos personales no se incluyen en GitHub.'),{status:503});
}
