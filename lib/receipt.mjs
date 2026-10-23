import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';

export async function paymentReceipt({member,concept,payment,logo,receiptNumber}){
 const pdf=await PDFDocument.create(),regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const purple=rgb(50/255,16/255,93/255),gold=rgb(.70,.53,.23),ink=rgb(.16,.12,.22),muted=rgb(.40,.38,.44);
 const snapshot=payment.receiptSnapshot||{};
 const clean=v=>Array.from(String(v??'').normalize('NFC').replace(/[\r\n\t\u202f\u00a0]/g,' ')).map(c=>{try{regular.encodeText(c);return c;}catch{return '?';}}).join('');
 const wrap=(value,size,width)=>{const lines=[];let line='';for(const word of clean(value).split(/\s+/)){for(const ch of (line?' ':'')+word){if(regular.widthOfTextAtSize(line+ch,size)>width){lines.push(line);line='';}line+=ch;}}if(line)lines.push(line);return lines.length?lines:['—'];};
 const pages=[];let page,y;
 const addPage=()=>{page=pdf.addPage([595.28,841.89]);pages.push(page);y=788;page.drawRectangle({x:0,y:818,width:596,height:24,color:purple});};
 addPage();
 const write=(value,{size=11,font=regular,color=ink,width=491}={})=>{for(const line of wrap(value,size,width)){if(y<90){addPage();}page.drawText(line,{x:52,y,size,font,color});y-=size+6;}};
 if(logo){const emblem=await pdf.embedPng(logo);page.drawImage(emblem,{x:52,y:704,width:90,height:90});}
 page.drawText('HSMI',{x:162,y:770,size:30,font:bold,color:purple});
 page.drawText('Hermandad del Señor de los Milagros de Ilo',{x:162,y:746,size:12,font:regular,color:ink});
 page.drawText('Padrón y tesorería',{x:162,y:727,size:10,font:regular,color:muted});
 y=674;write(payment.voidReason?'COMPROBANTE ANULADO':'COMPROBANTE DE PAGO',{size:20,font:bold,color:payment.voidReason?rgb(.7,.12,.12):purple});
 write('Comprobante interno de aportes',{size:10,color:muted});
 write('N.º '+(receiptNumber||('HSMI-'+payment.id.toUpperCase())),{size:9,font:bold});
 page.drawLine({start:{x:52,y:y-6},end:{x:543,y:y-6},thickness:1,color:gold});y-=35;
 const field=(label,value)=>{write(label.toUpperCase(),{size:9,font:bold,color:muted});write(value,{size:12});y-=9;};
 field('Integrante',snapshot.memberName||member.name);
 field('Código / grupo',(snapshot.memberCode||member.id)+' · '+(snapshot.group||member.group));
 field('Concepto',(snapshot.conceptName||concept.name)+' · '+(snapshot.conceptYear||concept.year));
 const date=payment.date.split('-');field('Fecha del pago',date.length===3?`${date[2]}/${date[1]}/${date[0]}`:payment.date);
 field('Importe de este pago','S/ '+(payment.amountCents/100).toFixed(2));
 field('Medio de pago',payment.method);
 if(payment.receipt)field('N.º de operación / referencia',payment.receipt);
 field('Registrado por',(snapshot.actorName?snapshot.actorName+' · ':'')+payment.actor);
 if(payment.recordedAt)field('Registro en el sistema',new Date(payment.recordedAt).toLocaleString('es-PE',{timeZone:'America/Lima'}));
 if(payment.note)field('Observación',payment.note);
 if(payment.voidReason)field('Motivo de anulación',payment.voidReason);
 for(let i=0;i<pages.length;i++){const p=pages[i];p.drawLine({start:{x:52,y:62},end:{x:543,y:62},thickness:.6,color:gold});p.drawText('HSMI · Constancia del aporte registrado en el sistema.',{x:52,y:45,size:9,font:regular,color:muted});p.drawText(`${i+1} / ${pages.length}`,{x:510,y:45,size:9,font:regular,color:muted});}
 pdf.setTitle('HSMI - Comprobante '+payment.id);pdf.setAuthor('HSMI · Tesorería');
 return pdf.save();
}
