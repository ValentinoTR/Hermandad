# HSMI · Padrón y cuotas

Aplicación de la Hermandad del Señor de los Milagros de Ilo. Next.js y PostgreSQL de Supabase; se publica desde GitHub en un alojamiento compatible con Node.js, como Vercel. Su funcionamiento no requiere ChatGPT.

Permite buscar integrantes, registrar pagos, marcar «No aplica» con motivo, consultar estados anuales y acumulados, gestionar permisos y descargar respaldos. «No aplica» no genera deuda; los espacios sin información quedan «Por revisar». Un integrante está activo cuando tiene cubiertas todas sus obligaciones aplicables.

## Desarrollo

Usa Node.js 22 o posterior. Ejecuta `npm ci`, configura las variables de `.env.example` en `.env.local` y ejecuta `npm run dev`. Verifica con `npm run typecheck`, `npm test` y `npm run build`.

## Base de datos

Las nueve tablas están en el esquema privado `hsmi`. El servidor usa el rol dedicado `hsmi_app`; no uses el usuario administrador de PostgreSQL en producción. Se requiere TLS y un máximo de cinco conexiones por instancia. Para el pooler en modo transacción se desactivan las consultas preparadas.

En una base nueva, ejecuta `npm run db:migrate` con `MIGRATION_DATABASE_URL` administrativo. Esta instalación se detiene si el esquema ya existe. En el proyecto original de HSMI el esquema y el padrón ya fueron importados: no repitas esa instalación.

Configura una contraseña fuerte y exclusiva para `hsmi_app` mediante la administración de PostgreSQL. Usa la dirección real de Supabase Connect y el usuario `hsmi_app.PROJECT_REF` para el pooler compartido. Guarda la URL únicamente en `DATABASE_URL` del servidor. No cambies las contraseñas ni permisos de otros proyectos.

Un respaldo privado del formato `hsmi-backup-v1` se importa mediante `npm run db:import -- /ruta/respaldo.json`. El proceso es transaccional y se detiene si ya hay integrantes. No importa contraseñas, sesiones ni la marca de activación de la aplicación anterior.

## Publicación y primer acceso

Importa este repositorio en Vercel, selecciona Next.js y configura `DATABASE_URL`, `HSMI_OWNER_EMAIL` y `HSMI_SETUP_HASH` como variables privadas. Publica y utiliza el dominio asignado o conecta un dominio propio.

Genera un token aleatorio de 32 bytes en hexadecimal y configura su SHA-256 en `HSMI_SETUP_HASH`. El administrador abre `https://TU-DOMINIO/#configurar=TOKEN` y crea su propia contraseña. El token es secreto y solo sirve para la primera activación. Después elimina `HSMI_SETUP_HASH` del alojamiento. Las invitaciones posteriores caducan a las 48 horas.

Las sesiones tienen cookies HttpOnly, SameSite=Strict y Secure en HTTPS. Los roles son administración, tesorería y consulta. Los cambios usan control de revisión para evitar que dos personas sobrescriban un registro. Pagos y auditoría se guardan en una misma transacción.

## Datos privados y recursos compartidos

Este repositorio público solo contiene código, el emblema y el catálogo de conceptos. No subas Excel, respaldos, nombres de integrantes ni archivos `.env`. Los respaldos contienen información personal y deben almacenarse con acceso restringido.

El esquema y el usuario propios separan HSMI de otras aplicaciones, pero al usar el mismo proyecto de Supabase comparten capacidad, límites, mantenimiento y disponibilidad. Para independencia completa, usa un proyecto separado. Revisa los límites de tu plan al aumentar el uso.

## Comprobantes PDF

Al guardar un pago, el navegador solicita la descarga del comprobante interno PDF. Si el navegador la bloquea, el aviso de pago guardado y los enlaces del historial permiten descargarlo sin repetir el pago. El identificador es el ID único del pago, se conservan los datos originales de los nuevos registros y las descargas de pagos anulados llevan la marca ANULADO. Se requiere sesión para acceder a cada PDF. El sistema no genera comprobantes para las marcas históricas P que carecen de importe y fecha.
