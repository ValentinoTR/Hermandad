import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'HSMI · Padrón y cuotas',description:'Hermandad del Señor de los Milagros de Ilo. Padrón, cuotas y tesorería.',icons:{icon:'/hsmi-emblema.png'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body>{children}</body></html>;}
