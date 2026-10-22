import 'server-only';
import postgres from 'postgres';
import {compileQuery} from './pg-query.mjs';
let client:ReturnType<typeof postgres>|undefined;
function getClient(){
 const url=process.env.DATABASE_URL;if(!url)throw Object.assign(new Error('Falta configurar DATABASE_URL en el servidor.'),{status:503});
 if(!client)client=postgres(url,{prepare:false,max:5,idle_timeout:20,connect_timeout:15,ssl:'require'});return client;
}
export class Statement{
 readonly sql:string;readonly parameterCount:number;
 constructor(query:string,readonly values:any[]=[]){const compiled=compileQuery(query);this.sql=compiled.sql;this.parameterCount=compiled.parameterCount;}
 bind(...values:any[]){if(values.length!==this.parameterCount)throw new Error('Cantidad de parámetros incorrecta.');return new Statement(this.sql,values);}
 async execute(connection:any=getClient()){const rows=await connection.unsafe(this.sql,this.values);return {results:Array.from(rows) as any[],meta:{changes:Number(rows.count||0)}};}
 async all<T=Record<string,unknown>>(){const result=await this.execute();return {...result,results:result.results as T[]};}
 async first<T=Record<string,unknown>>(){return (await this.all<T>()).results[0]||null;}
 async run(){return this.execute();}
}
export function getDatabase(){return {prepare:(sql:string)=>new Statement(sql),batch:async(statements:Statement[])=>getClient().begin(async(tx:any)=>{const result=[];for(const statement of statements)result.push(await statement.execute(tx));return result;})};}
