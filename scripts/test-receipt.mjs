import {paymentReceipt} from '../lib/receipt.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {PDFDocument} from 'pdf-lib';
import assert from 'node:assert/strict';
const logo=await readFile(new URL('../public/hsmi-emblema.png',import.meta.url));
const member={id:'DEMO-001',name:'Nombre editado',group:'Cuadrilla 2'};
const concept={name:'Cuota',year:2026};
const payment={id:'00000000-0000-4000-8000-000000000080',date:'2026-10-22',amountCents:8000,method:'Transferencia',receipt:'OP-123456',note:'Pago de cuota anual.',actor:'tesoreria@example.com',recordedAt:'2026-10-22T15:30:00Z',receiptSnapshot:{memberName:'María Pérez — EJEMPLO',memberCode:'DEMO-001',group:'Cuadrilla 2',conceptName:'Cuota anual',conceptYear:2026,actorName:'Tesorería de prueba'}};
const bytes=await paymentReceipt({member,concept,payment,logo});
assert.equal((await PDFDocument.load(bytes)).getPageCount(),1);
const long=await paymentReceipt({member,concept,payment:{...payment,note:'Observación larga con tildes y símbolos ✓ '.repeat(40),voidReason:'Prueba de anulación.'},logo});
assert.ok((await PDFDocument.load(long)).getPageCount()>1);
if(process.env.HSMI_PDF_EXAMPLES){await mkdir('../../outputs',{recursive:true});await writeFile('../../outputs/HSMI-comprobante-ejemplo.pdf',bytes);await writeFile('../../work/hsmi-receipt-long.pdf',long);}
console.log('PASS: PDF con imagen, S/ 80, tildes, anulación y texto largo en varias páginas.');
