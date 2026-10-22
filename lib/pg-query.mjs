const tables='members|concepts|audit|app_users|settings|credentials|sessions|invitations|auth_limits';
export function compileQuery(input){
 let sql=input.trim().replace(/;$/,'');
 const ignore=/\bINSERT OR IGNORE INTO\b/i.test(sql);sql=sql.replace(/\bINSERT OR IGNORE INTO\b/gi,'INSERT INTO');
 sql=sql.replace(new RegExp('\\b(FROM|JOIN|UPDATE|INTO)\\s+('+tables+')\\b','gi'),(_,keyword,table)=>`${keyword} hsmi.${table}`);
 sql=sql.replace(/ORDER BY name COLLATE NOCASE/gi,'ORDER BY lower(name)');
 let n=0,quoted=false,out='';for(let i=0;i<sql.length;i++){const c=sql[i];if(c==="'"){out+=c;if(quoted&&sql[i+1]==="'"){out+=sql[++i];continue;}quoted=!quoted;}else out+=c==='?'&&!quoted?'$'+(++n):c;}
 if(ignore)out+=' ON CONFLICT DO NOTHING';return {sql:out,parameterCount:n};
}
