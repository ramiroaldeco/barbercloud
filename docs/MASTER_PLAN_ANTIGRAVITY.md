# MASTER_PLAN_ANTIGRAVITY

> **Single Source of Truth (SSOT)** para el agente Antigravity sobre el proyecto SaaS de barberías **BarberCloud**.  
> Este documento consolida:  
> 1) el estado real del código auditado,  
> 2) la estrategia/roadmap del documento fuente `Sistema SaaS barberías.docx`,  
> 3) el análisis técnico previo del proyecto.  
>
> **Regla de precedencia obligatoria para Antigravity:**
> 1. **Código actualmente existente** (realidad operativa del sistema)
> 2. **Este MASTER_PLAN_ANTIGRAVITY.md**
> 3. **Roadmap estratégico del DOCX**
> 4. Cualquier inferencia nueva
>
> Si hay conflicto entre el roadmap y el código actual, **se asume que el código manda** y el roadmap pasa a ser objetivo futuro.

---

# 1. Visión Ejecutiva y Propósito

## 1.1 Qué es el SaaS
**BarberCloud** es un SaaS multi-tenant para barberías y peluquerías enfocado en:

- reservas online 24/7,
- reducción de no-shows,
- gestión de agenda,
- configuración de servicios,
- configuración de porcentaje de seña,
- cobro de una comisión fija/plataforma,
- acceso administrativo por barbería,
- enlaces públicos por `slug`.

## 1.2 Problema crítico que resuelve
Las barberías suelen operar con WhatsApp/manualidad/libretas, lo que genera:

- pérdida de turnos,
- doble reserva,
- mala trazabilidad,
- ausencias sin seña,
- dependencia del dueño para responder mensajes,
- falta de una agenda centralizada,
- dificultad para escalar a múltiples locales, múltiples barberos o automatización.

## 1.3 Propuesta de valor
El producto busca centralizar el flujo completo:

1. la barbería se registra,
2. configura su local,
3. define servicios,
4. define horarios/disponibilidad,
5. comparte un enlace público,
6. el cliente reserva,
7. se calcula una seña,
8. a futuro se cobra automáticamente por Mercado Pago,
9. el negocio gana orden, trazabilidad y previsibilidad.

## 1.4 Usuarios del sistema
### Actores actuales / previstos
- **Owner (dueño de barbería):** administra barbería, servicios, agenda y configuración.
- **Cliente final:** reserva un turno.
- **Admin de plataforma:** previsto en roadmap, no totalmente implementado.
- **Barbero/Empleado:** previsto en roadmap, no totalmente implementado.

## 1.5 Modelo de monetización esperado
El proyecto está concebido para monetizar por dos vías:

- **Seña configurable por servicio o por barbería**
- **Fee fijo de plataforma (`platformFee`)**

A futuro, el roadmap también contempla:

- suscripción mensual,
- módulos premium,
- marketing,
- CRM,
- automatización,
- IA recepcionista,
- notificaciones por WhatsApp,
- reportes avanzados.

---

# 2. Contexto Global del Proyecto

## 2.1 Nombre de producto
**BarberCloud**

## 2.2 Repositorios conocidos
### Backend
- Repo: `ramiroaldeco/barbercloud`

### Frontend
- Repo: `ramiroaldeco/barbercloudFRONTEND`

## 2.3 Runtime / despliegue conocido
### API base expuesta por frontend
```js
const API_BASE = "https://barbercloud.onrender.com/api";
Despliegue esperado

Backend: Render

Frontend: Vercel / GitHub Pages / localhost en desarrollo

2.4 CORS actualmente permitido

El backend acepta:

cualquier origen *.vercel.app

http://localhost:5500

http://127.0.0.1:5500

https://ramiroaldeco.github.io

requests sin origin (Postman/curl/server-to-server)

3. Estado Real del Proyecto (Diagnóstico Consolidado)
3.1 Etapa actual

El proyecto está en una etapa de MVP funcional parcial / pre-beta técnica.

Ya existe

auth básica con JWT,

onboarding de barbería + owner,

barbería con slug,

servicios,

creación de turnos,

cálculo de seña,

landing pública,

panel admin básico,

panel admin v2 en desarrollo,

base de Prisma,

seed demo,

lógica de horarios y bloqueos escrita en archivos separados.

Está parcialmente implementado / inconsistente

disponibilidad real basada en horarios,

booking público por slug,

consistencia de pricing entre frontend/backend,

rutas montadas vs rutas existentes,

consistencia de Prisma schema con el código.

Está planeado pero no integrado

Mercado Pago real,

email/WhatsApp,

reportes avanzados,

CRM,

empleados/barberos/sillas,

marketplace real,

reseñas,

campañas,

integraciones sociales,

IA recepcionista.

3.2 Diagnóstico técnico: realidad importante

El código auditado muestra que hay más de un flujo de reserva coexistiendo.

> **Actualizado (Sprint 1 — 2026-03-10):** Se auditó el código real completo. Varias alarmas anteriores estaban desactualizadas.

Estado corregido tras auditoría Sprint 1

✅ publicBooking.js, workingHours.js y blockedTimes.js SÍ ESTÁN MONTADOS en server.js

✅ Los modelos WorkingHour y BlockedTime SÍ EXISTEN en schema.prisma

✅ Los campos Service.description, Appointment.customerEmail y Appointment.notes SÍ EXISTEN en schema.prisma

✅ CORS ya incluye x-admin-key en allowedHeaders

✅ appointments.js ahora usa shop.platformFee desde DB (no ENV)

✅ Pricing corregido en Sprint 1: depositAmount separado de platformFee, se guardan depositPercentageAtBooking y totalToPay

✅ book.js ahora usa service.depositPercentage si existe, con fallback a barbershop.defaultDepositPercentage

✅ admin.js token getToken() ahora lee bc_token con fallback a token

Puntos que siguen vigentes

Hay dos paradigmas de reserva conviviendo

flujo legacy por barbershopId y POST /api/appointments

flujo nuevo por slug y disponibilidad calculada (publicBooking.js)

Diferencia de expiración JWT

login normal: 7d

onboarding: 30d

platformFee no es administrable desde el panel admin (settings solo cambia defaultDepositPercentage)

Conclusión operativa: La base técnica fue consolidada en Sprint 1. Los próximos pasos son unificar booking y hacer disponibilidad real usable.

4. Inventario y Mapeo de Archivos
4.1 Backend — inventario conocido
Archivo	Rol técnico	Estado / Notas
.gitignore	Exclusión de archivos sensibles / temporales	Soporte de repo
server.js	Punto de entrada Express, CORS, healthcheck, montaje de rutas, listen por PORT	Crítico
auth.js	Registro/login owner, bcrypt, JWT	Implementado
authMiddleware.js	Middleware Bearer token/JWT	Implementado
onboarding.js	Signup unificado: crea barbería + owner + servicios demo + token	Implementado
barbershops.js	CRUD parcial de barberías; slug lookup; settings de barbería; barbería actual	Implementado parcial
services.js	Listado público y alta privada de servicios	Implementado parcial
appointments.js	Listado privado de turnos, endpoint público simple, creación de turno con pricing	Implementado parcial
publicBooking.js	Cálculo de disponibilidad por slug y reserva pública por slug	Escrito, pero posible no montado
workingHours.js	Gestión de plantilla semanal de horarios	Escrito, pero posible no montado
blockedTimes.js	Gestión de bloqueos por fecha/rango/franja	Escrito, pero posible no montado
prisma.js	Instancia singleton de PrismaClient	Implementado
package.json	Scripts y dependencias de backend	Implementado
package-lock.json	Lockfile npm	Implementado
prisma/schema.prisma	Modelo de datos Prisma	Crítico; potencial drift
prisma/seed.js	Seed demo (barbería demo + servicios demo + owner demo)	Implementado
prisma/migrations/	Migraciones Prisma	Existe directorio; validar contenido real
4.2 Frontend — inventario conocido
Archivo	Rol técnico	Estado / Notas
index.html	Landing pública / marketing / demo de reserva	Implementado
styles.css	Estilos generales del sitio principal	Implementado
config.js	Define API_BASE	Crítico
app.js	Lógica de formulario demo en landing (index.html)	Implementado
signup.html	UI de alta/onboarding	Implementado
signup.js	Envía onboarding, guarda token en múltiples claves de localStorage	Implementado
admin.html	Panel admin básico	Implementado
admin.js	Login admin básico, settings, link público, logout	Implementado
admin_v2.html	Nueva UI SPA del panel	En desarrollo
admin_v2.css	Estilos del panel v2	En desarrollo
admin_v2.js	SPA admin más avanzada: agenda, servicios, horarios, clientes, config	En desarrollo / dependiente de endpoints
book.html	Página pública de reserva	Implementado parcial
book.js	Resolución por slug, carga barbería/servicios, reserva y pricing UI	Implementado parcial / contrato inconsistente
components.css	Estilos utilitarios/componentes	Soporte visual
vercel.json	Config de despliegue frontend	Crítico para routing/deploy
4.3 Archivos fuente estratégicos cargados
Archivo	Tipo	Rol
Sistema SaaS barberías.docx	Documento de estrategia/roadmap	Define visión, benchmarking y fases futuras
report.md	Informe previo de auditoría	Análisis técnico del estado del producto
5. Arquitectura del Sistema
5.1 Stack tecnológico actual
Backend

Node.js

Express

Prisma

PostgreSQL

bcryptjs

jsonwebtoken

cors

dotenv

Frontend

HTML

CSS

JavaScript vanilla

despliegue estático en Vercel/GitHub Pages

5.2 Estilo arquitectónico actual

Arquitectura simple, monolítica, de baja complejidad operativa:

backend Express monolítico

frontend estático desacoplado

comunicación vía REST JSON

auth stateless por JWT

multi-tenant lógico por barbershopId y slug

5.3 Arquitectura de carpetas backend (actual aproximada)
backend/
  server.js
  auth.js
  authMiddleware.js
  onboarding.js
  barbershops.js
  services.js
  appointments.js
  publicBooking.js
  workingHours.js
  blockedTimes.js
  prisma.js
  package.json
  prisma/
    schema.prisma
    seed.js
    migrations/
5.4 Arquitectura de carpetas frontend (actual aproximada)
frontend/
  index.html
  styles.css
  components.css
  config.js
  app.js
  signup.html
  signup.js
  admin.html
  admin.js
  admin_v2.html
  admin_v2.css
  admin_v2.js
  book.html
  book.js
  vercel.json
6. Base de Datos y Modelo de Dominio
6.1 Modelos confirmados por schema auditado
Barbershop

Campos conocidos:

id

name

city

address?

phone?

slug? (unique)

defaultDepositPercentage

platformFee

Relaciones:

services[]

appointments[]

users[]

Service

Campos conocidos:

id

barbershopId

name

price

durationMinutes

depositPercentage?

Relaciones:

barbershop

appointments[]

Appointment

Campos conocidos:

id

barbershopId

serviceId

customerName

customerPhone

date

time

status

paymentStatus

depositPercentageAtBooking

depositAmount

platformFee

totalToPay

createdAt

Constraint crítica:

@@unique([barbershopId, date, time])
BarbershopUser

Campos conocidos:

id

barbershopId

name

email

passwordHash

role

createdAt

6.2 Modelos/campos — estado confirmado

> **Actualizado (Sprint 1 — 2026-03-10):** Se auditó el schema.prisma real completo.

✅ Todos los modelos y campos referenciados por código EXISTEN en el schema:

WorkingHour — modelo completo con id, barbershopId, weekday, startTime, endTime

BlockedTime — modelo completo con id, barbershopId, dateFrom, dateTo, startTime, endTime, reason

Service.description — campo String? existente

Appointment.customerEmail — campo String? existente

Appointment.notes — campo String? existente

6.3 Estado actual

No hay drift entre schema y código. Las migraciones están al día.
No se requieren nuevas migraciones para el estado actual del proyecto.

7. Flujo de Datos y Flujos Funcionales
7.1 Flujo de onboarding actual
signup.html/signup.js
  -> POST /api/onboarding/signup
    -> onboarding.js
      -> crea Barbershop
      -> crea BarbershopUser role=owner
      -> crea servicios demo
      -> genera JWT
  -> guarda token en localStorage
  -> redirige a admin.html
7.2 Flujo de login owner actual
admin.html/admin.js o admin_v2.js
  -> POST /api/auth/login
    -> auth.js
      -> busca usuario por email
      -> compara passwordHash
      -> firma JWT
  -> frontend guarda token
  -> llamadas privadas usan Authorization: Bearer <token>
7.3 Flujo de settings actual
admin.js
  -> GET /api/barbershops/mine
  -> muestra barbería + slug + defaultDepositPercentage
  -> PUT /api/barbershops/mine/settings
     body: { defaultDepositPercentage }
7.4 Flujo de reserva legacy actual
index.html + app.js
  -> GET /api/barbershops
  -> GET /api/services?barbershopId=<id>
  -> POST /api/appointments
     body: {
       barbershopId,
       serviceId,
       customerName,
       customerPhone,
       date,
       time
     }
7.5 Flujo de reserva pública moderna (objetivo / parcial)
book.html + book.js
  -> resuelve shop por slug
  -> obtiene barbería
  -> obtiene servicios
  -> idealmente: disponibilidad real
  -> crea reserva
  -> muestra pricing
  -> a futuro: checkout Mercado Pago
7.6 Flujo de disponibilidad planeado en código

publicBooking.js implementa un motor de slots:

Inputs

barbershopId

serviceId

date

step

Datos consultados

duración del servicio

rangos de workingHour

bloqueos de blockedTime

appointments ya tomadas/no canceladas

Salida

slots disponibles calculados respetando:

horario semanal,

duración,

bloqueos,

turnos existentes,

horarios pasados si la fecha es hoy.

8. Desglose de Módulos Funcionales
8.1 Módulo de autenticación
Archivo principal

auth.js

Funciones actuales

register owner

login

emisión de JWT

Reglas actuales

email único

password hasheada con bcrypt

JWT con userId, barbershopId, role

Observaciones

no hay refresh token

no hay MFA

no hay reset password

no hay verify email

no hay auth robusta para varios roles todavía

8.2 Módulo de autorización
Archivo principal

authMiddleware.js

Contrato

espera Authorization: Bearer <token>

si no hay token -> 401

si token inválido -> 401

si token válido -> req.user

Observación

El backend usa role como mecanismo de permisos. Hoy el rol real activo es básicamente owner.

8.3 Módulo de onboarding
Archivo principal

onboarding.js

Capacidades

crea barbería

genera slug único

crea owner

crea servicios demo

devuelve token

reduce fricción inicial

Lógica crítica

Slug actual:

lowercase

remueve tildes

remueve no alfanumérico

no usa guiones, genera strings compactos

Riesgo

Si Antigravity cambia el algoritmo de slug, debe preservar compatibilidad con slugs existentes o migrarlos correctamente.

8.4 Módulo de barberías
Archivo principal

barbershops.js

Capacidades actuales

listar barberías públicas

crear barbería (modo demo / admin key opcional)

lookup por slug

obtener barbería actual (/mine)

actualizar settings

Limitaciones actuales

settings solo cambia defaultDepositPercentage

platformFee no queda verdaderamente editable desde settings

no hay update general de branding/datos completos desde panel v2 claramente consolidado

no hay disable/soft delete visible en código actual auditado

8.5 Módulo de servicios
Archivo principal

services.js

Capacidades actuales

listar servicios públicos por barbería

crear servicio privado por owner

Limitaciones

No están auditados endpoints de:

update servicio

delete/disable servicio

reorder

imágenes

categorías

multi-barber specialization

8.6 Módulo de agenda/appointments
Archivo principal

appointments.js

Capacidades actuales

listar turnos privados

endpoint público simple de turnos

crear turno

calcula seña

evita doble reserva

Lógica actual de pricing

toma barbería,

toma servicio,

si el servicio tiene depositPercentage usa ese valor,

si no, usa barbershop.defaultDepositPercentage,

limita entre 0 y 100,

calcula:

depositAmount

platformFee

totalToPay

Observación crítica

En appointments.js, el platformFee visible usa:

Number(process.env.PLATFORM_FEE ?? 200)

y no necesariamente barbershop.platformFee.

Eso genera desalineación con otras partes del sistema.

8.7 Módulo de disponibilidad
Archivo principal

publicBooking.js

Capacidades escritas

obtener barbería por slug

listar servicios por slug

calcular availability

crear reserva pública validando slot

Dependencias implícitas

workingHour

blockedTime

appointments

service duration

Estado

Parcial / posiblemente no montado.

8.8 Módulo de horarios de trabajo
Archivo principal

workingHours.js

Capacidades escritas

guardar plantilla semanal

validar rangos

evitar solapes

reemplazar plantilla por transacción

Estado

Escrito, pero verificar:

montaje real en server.js

existencia del modelo Prisma

uso real desde admin_v2.js

8.9 Módulo de bloqueos
Archivo principal

blockedTimes.js

Capacidades escritas

listar bloqueos

crear bloqueos

eliminar bloqueos

soporta:

día completo

rango de días

franja horaria

Estado

Escrito, pero verificar:

montaje real

modelo Prisma

UI real conectada

8.10 Módulo de panel admin básico
Archivos principales

admin.html

admin.js

Funciones

login

ver barbería

ver ciudad

ver/usar slug

copiar link público

modificar % de seña

logout

Observación

Es el panel más estable hoy.

8.11 Módulo de panel admin v2
Archivos principales

admin_v2.html

admin_v2.css

admin_v2.js

Intención funcional

SPA con vistas:

agenda

clientes

servicios

horarios

configuración

Estado

Muy importante, pero dependiente de endpoints probablemente aún no consolidados.

8.12 Módulo de landing pública
Archivos

index.html

app.js

styles.css

Función

marketing

demo

formulario conectado al backend

validación básica

Estado

Implementado, pero responde al flujo legacy.

8.13 Módulo de booking público por slug
Archivos

book.html

book.js

Función

resolver barbería desde URL

mostrar servicios

reservar

Observaciones críticas

usa slug para resolver barbería,

pero todavía hace POST al flujo legacy /api/appointments,

y espera un contrato de pricing no totalmente alineado con appointments.js.

8.14 Integración Mercado Pago
Estado actual

No implementada realmente.

Evidencia

El backend ya deja mensajes del tipo:

“Integrar MercadoPago”

“cobrar totalToPay y confirmar turno cuando paymentStatus=paid”

Roadmap futuro

preferencia de pago,

OAuth por barbería,

webhook/IPN,

split/fee,

reintento,

reembolso.

8.15 Notificaciones email / WhatsApp
Estado actual

Planeado, no implementado en el código auditado.

Roadmap explícito

email confirmación

reminder 24h antes

WhatsApp template

confirm/cancel desde botones

cola de notificaciones

8.16 CRM / clientes / reportes
Estado actual

No se ve implementación completa en backend auditado.

Estado en frontend

admin_v2.js anticipa una vista de clientes, pero no está respaldada por un módulo backend auditado completo.

9. Contratos Técnicos Relevantes
9.1 Variables de entorno críticas

Antigravity no debe romper ni asumir defaults silenciosos en estas variables:

DATABASE_URL=
JWT_SECRET=
PORT=
PLATFORM_FEE=
PLATFORM_ADMIN_KEY=
9.2 Scripts backend conocidos
{
  "dev": "nodemon server.js",
  "start": "node server.js",
  "prisma:migrate": "npx prisma migrate dev",
  "prisma:generate": "npx prisma generate",
  "prisma:studio": "npx prisma studio",
  "seed": "node prisma/seed.js",
  "postinstall": "npm run prisma:generate"
}
9.3 Enum-like states actuales
Appointment.status

pending

confirmed

canceled

Appointment.paymentStatus

unpaid

paid

refunded

9.4 Contrato de auth

JWT contiene:

{
  "userId": 1,
  "barbershopId": 1,
  "role": "owner"
}
9.5 Claves de localStorage detectadas

El frontend usa varias claves para token:

bc_token

token

jwt

authToken

Regla obligatoria

Antigravity no debe romper compatibilidad con claves ya usadas sin migración explícita.

10. Inconsistencias y Riesgos que Antigravity Debe Conocer
10.1 Drift entre schema y código

> **Actualizado (Sprint 1 — 2026-03-10):** ✅ RESUELTO. No hay drift. Todos los modelos y campos están alineados.

10.2 Rutas montadas

> **Actualizado (Sprint 1 — 2026-03-10):** ✅ RESUELTO. Todas las rutas están montadas en server.js:

/api/auth

/api/onboarding

/api/barbershops

/api/services

/api/appointments

/api/working-hours

/api/public (publicBooking.js)

/api/blocked-times

10.3 Dos flujos de reserva coexistiendo
Legacy

landing demo

barbershopId

hora manual

/api/appointments

Nuevo (principal)

slug

availability real

/api/public/:slug/book

Antigravity debe evolucionar hacia el flujo por slug como único flujo público. El legacy queda como demo/fallback.

10.4 Pricing

> **Actualizado (Sprint 1 — 2026-03-10):** ✅ CORREGIDO. Ahora hay una única fuente de pricing:

platformFee = barbershop.platformFee (desde DB)

depositPercentage = service.depositPercentage ?? barbershop.defaultDepositPercentage

depositAmount = price * depositPct / 100 (separado del fee)

totalToPay = depositAmount + platformFee

Esta fórmula es consistente entre appointments.js y publicBooking.js.

10.5 Contrato frontend/backend inconsistente en booking

book.js muestra pricing desde campos root, pero el backend legacy devuelve estructura anidada.

10.6 Roles incompletos

El roadmap exige:

admin

owner

barber

client

El código auditado está mucho más cerca de:

owner

cliente implícito

admin/plataforma parcial/no formalizado

barber no implementado como usuario operativo real

10.7 Panel v2 puede estar por delante del backend

No asumir que por existir UI ya existe endpoint estable.

11. Hoja de Ruta Estratégica (Roadmap) Integrada

Esta sección consolida la información estratégica del archivo fuente Sistema SaaS barberías.docx.
Representa el target state, no necesariamente el estado actual del código.

Fase 0 — Planificación y diseño

Objetivos:

validar requisitos con barberías reales,

definir MVP / importantes / futuras,

wireframes,

stack definitivo,

arquitectura de carpetas,

modelado de datos completo,

decidir integraciones externas.

Fase 1 — Base técnica

Objetivos:

inicializar backend,

conectar PostgreSQL,

migraciones,

seed,

auth y autorización por roles,

estructura base de seguridad.

Fase 2 — CRUD fundamentales

Objetivos:

barberías,

servicios,

horarios,

excepciones,

barberos,

sillas.

Fase 3 — Reservas y disponibilidad

Objetivos:

SlotService robusto,

disponibilidad por servicio/barbero/fecha,

reservas transaccionales,

reprogramación,

cancelación,

manejo de concurrencia.

Fase 4 — Mercado Pago

Objetivos:

OAuth por barbería,

preferencias de pago,

webhook/IPN,

actualización automática de payment status,

retries,

reembolsos.

Fase 5 — Notificaciones

Objetivos:

email,

WhatsApp Business API,

templates,

cron de recordatorios,

notificaciones internas.

Fase 6 — Frontend público

Objetivos:

home con marketplace,

detalle de barbería,

flujo paso a paso,

feedback,

checkout,

UX completa de reserva.

Fase 7 — Dashboard dueño/barbero

Objetivos:

agenda diaria/semanal/mensual,

servicios,

empleados,

clientes/CRM,

reportes,

configuraciones,

módulo financiero.

Fase 8 — Marketplace social

Objetivos:

búsqueda avanzada,

reseñas,

referidos,

campañas.

Fase 9 — Features avanzadas

Objetivos:

recepcionista IA,

sincronización Google Calendar,

app móvil,

redes sociales,

inventario,

AFIP/facturación,

analytics predictivo.

Fase 10 — QA y despliegue

Objetivos:

unit tests,

integration tests,

E2E,

load tests,

hardening de seguridad,

Docker,

staging/prod,

monitoreo,

beta cerrada,

soporte,

pricing final.

12. Estado Actual vs Objetivo Futuro
12.1 Matriz de madurez
Módulo	Estado
Landing pública	Implementado
Onboarding owner	Implementado
Auth owner	Implementado
JWT middleware	Implementado
Slug por barbería	Implementado
Listado de barberías	Implementado
Servicios (listar/crear)	Parcial
Settings barbería	Parcial
Reserva legacy	Implementada
Pricing básico	Implementado con inconsistencias
Disponibilidad por horarios reales	Parcial / no consolidada
Horarios semanales	Parcial / verificar montaje
Bloqueos	Parcial / verificar montaje
Booking público por slug	Parcial / inconsistente
Panel admin básico	Implementado
Panel admin v2	En desarrollo
Mercado Pago real	No implementado
Notificaciones email	No implementado
Notificaciones WhatsApp	No implementado
CRM clientes	No implementado
Reportes avanzados	No implementado
Empleados/barberos reales	No implementado
Sillas/estaciones	No implementado
Marketplace avanzado	No implementado
Reseñas	No implementado
Referidos	No implementado
IA recepcionista	No implementado
13. Prioridades Inmediatas para Antigravity
13.1 Prioridad 1 — Consolidación técnica obligatoria

Antigravity debe priorizar esto antes de agregar features grandes:

auditar schema.prisma real,

auditar migraciones,

confirmar modelos faltantes,

montar rutas faltantes si corresponde,

consolidar un único flujo de booking,

normalizar pricing,

normalizar contratos de respuesta,

normalizar claves de auth frontend.

13.2 Prioridad 2 — Convertir disponibilidad en feature real

Objetivo:

que el booking público no dependa de escribir hora manual,

que use horarios + bloqueos + duración + colisiones.

13.3 Prioridad 3 — Unificar panel admin con backend real

Objetivo:

asegurar que admin_v2.js solo use endpoints existentes y estables,

cerrar brecha entre UI y API.

13.4 Prioridad 4 — Mercado Pago

Objetivo:

pasar de “pricing calculado” a “cobro real”.

13.5 Prioridad 5 — Notificaciones

Objetivo:

confirmar,

recordar,

reducir no-show.

14. Reglas de Codificación y Estilo para Antigravity
14.1 Regla general

No hacer refactors masivos no pedidos.
Aplicar el cambio mínimo necesario para resolver el objetivo del usuario sin romper comportamiento existente.

14.2 Estilo backend

Mantener CommonJS (require, module.exports) salvo migración pedida explícitamente.

Mantener Express simple y claro.

Mantener respuestas JSON consistentes.

Validar todo input de usuario.

No esconder errores silenciosamente.

Usar Number(...) / coerción explícita donde hoy ya exista patrón.

Respetar barbershopId como límite multi-tenant.

Si un cambio toca booking, usar transacción o verificación anticollision.

14.3 Estilo frontend

Mantener vanilla JS salvo migración pedida.

No introducir frameworks sin pedido explícito.

Mantener compatibilidad con config.js donde API_BASE ya incluye /api.

No duplicar lógica si ya existe helper.

Si se cambia contrato API, actualizar todos los archivos consumidores.

14.4 Estilo de naming

Mantener nombres actuales si no hay razón fuerte para romper.

Evitar renombrar rutas públicas sin migración.

No cambiar slug o estructura de URL pública sin plan de compatibilidad.

14.5 Regla de backward compatibility

Antigravity debe asumir que hoy pueden estar en uso:

slugs existentes,

links públicos ya compartidos,

tokens guardados en localStorage,

deploys apuntando a Render/Vercel.

Por eso:

no romper contratos públicos sin avisar,

no eliminar fallback legacy si no se reemplaza completo,

no cambiar variables de entorno críticas sin documentarlo.

15. Manejo de Errores (Obligatorio)
15.1 HTTP status codes

Usar consistentemente:

400 -> input inválido / faltan datos

401 -> auth requerida / token inválido

403 -> sin permisos

404 -> recurso inexistente

409 -> conflicto de negocio (slot ocupado, email duplicado)

500 -> error interno

15.2 Forma sugerida de respuesta de error
{
  "ok": false,
  "error": "Mensaje claro y corto"
}
15.3 Logging

Loggear errores del servidor con contexto útil.

Nunca loggear secretos.

Nunca exponer stack traces al cliente final.

Si el error es de concurrencia/reserva, dejar mensaje funcional al usuario.

15.4 Casos especiales obligatorios
Booking

si el horario ya fue tomado -> 409

si servicio no pertenece a barbería -> 400

si barbería no existe -> 404

Auth

credenciales inválidas -> 401

Prisma

atrapar conflictos únicos (P2002) y devolver 409 cuando aplique.

16. Dependencias Críticas que No Deben Romperse
16.1 Dependencias npm backend

express

@prisma/client

prisma

bcryptjs

jsonwebtoken

cors

dotenv

nodemon (dev)

16.2 Dependencias conceptuales críticas

PostgreSQL / Prisma schema

Render deployment

Vercel/GitHub Pages/static hosting

JWT auth

API_BASE

slugs públicos

barbershopId como partición multi-tenant

16.3 Contratos críticos a preservar

Authorization: Bearer <token>

GET /api/barbershops/mine

PUT /api/barbershops/mine/settings

GET /api/services?barbershopId=...

POST /api/appointments

POST /api/onboarding/signup

POST /api/auth/login

17. Recomendaciones Técnicas de Consolidación
17.1 Unificar booking

Antigravity debe definir explícitamente uno de estos caminos:

Opción A — Evolucionar flujo legacy

mantener /api/appointments

agregarle availability real

hacer que book.js y index.html converjan ahí

Opción B — Evolucionar flujo por slug

montar publicBooking.js

mover book.js al flujo /:slug/...

dejar legacy solo como demo o eliminarlo luego

Recomendación

Opción B como dirección correcta, pero sin romper demo actual hasta migrar completamente.

17.2 Normalizar pricing

Definir una única regla:

depositPercentage =
  service.depositPercentage ?? barbershop.defaultDepositPercentage

platformFee =
  barbershop.platformFee

totalToPay =
  depositAmount + platformFee

No mezclar DB y ENV salvo que exista una regla formal documentada.

17.3 Normalizar respuesta de create appointment

Elegir una forma única y usarla en todos los consumidores.
Ejemplo recomendado:

{
  "ok": true,
  "appointment": {
    "id": 123,
    "status": "pending",
    "paymentStatus": "unpaid"
  },
  "pricing": {
    "servicePrice": 7000,
    "depositPercentage": 15,
    "depositAmount": 1050,
    "platformFee": 200,
    "totalToPay": 1250
  }
}
17.4 Normalizar tokens frontend

Mantener compatibilidad, pero converger hacia una sola clave canónica:

bc_token

Sin romper las demás hasta migrar todo.

18. Roadmap Operativo Inmediato (Orden recomendado de ejecución)
Sprint 1 — Higiene crítica

auditar schema real,

montar rutas faltantes o descartar código muerto,

alinear frontend/backend en booking,

documentar contratos,

corregir pricing inconsistente.

Sprint 2 — Disponibilidad usable

working hours end-to-end,

blocked times end-to-end,

availability endpoint estable,

UI de selección de slots.

Sprint 3 — Admin v2 usable

servicios,

agenda,

horarios,

config,

clientes solo si backend existe.

Sprint 4 — Mercado Pago

preferencia,

webhook,

confirmación automática.

Sprint 5 — Notificaciones

email,

WhatsApp,

cron reminders.

Sprint 6 — Comercialización

marketplace,

reportes,

CRM,

campañas,

reviews/referidos.

19. Qué Debe Hacer Antigravity Cada Vez que el Usuario Pida un Cambio
19.1 Proceso obligatorio de análisis

Antes de tocar código, Antigravity debe responder internamente estas preguntas:

¿El cambio impacta backend, frontend, schema o deploy?

¿Hay contrato API existente que se pueda romper?

¿El flujo afectado es legacy, nuevo o ambos?

¿Hay drift entre lo pedido y el estado real del código?

¿Se necesita migración Prisma?

¿Se necesita cambio de variables de entorno?

¿Hay que actualizar más de un archivo consumidor?

¿Hay que mantener backward compatibility temporal?

19.2 Regla de modificación

Antigravity debe trabajar con enfoque minimal diff + full context:

tocar lo mínimo,

pero entender el flujo completo antes de cambiarlo,

no parchear a ciegas,

no introducir deuda nueva innecesaria.

19.3 Formato recomendado de respuesta de Antigravity al proponer cambios

Siempre que sea posible, Antigravity debería entregar:

Objetivo del cambio

Archivos a tocar

Riesgo de ruptura

Plan de implementación

Cambios de backend

Cambios de frontend

Cambios de schema/env

Checklist de validación

19.4 Checklist de validación obligatoria

Después de un cambio, Antigravity debe validar:

build / sintaxis correcta,

rutas montadas,

contratos frontend/backend alineados,

auth no rota,

booking no roto,

pricing consistente,

multi-tenant preservado,

slugs y links públicos preservados,

no se rompió API_BASE,

si hubo cambios Prisma: migración + seed + compatibilidad.

20. Protocolo de Trabajo (Sección final obligatoria)
PROTOCOLO OPERATIVO PARA ANTIGRAVITY
Regla 1 — Leer primero este archivo

Antes de cualquier cambio, Antigravity debe leer MASTER_PLAN_ANTIGRAVITY.md como fuente de verdad del sistema.

Regla 2 — Diferenciar estado actual vs objetivo futuro

No confundir roadmap con implementación real.
Si una feature está en el roadmap pero no en código, tratarla como nueva implementación, no como “ajuste menor”.

Regla 3 — Auditar impacto antes de editar

Cada pedido debe clasificarse en una de estas categorías:

frontend UI,

backend API,

auth,

booking/disponibilidad,

pricing,

Prisma/schema,

deploy/config,

producto/roadmap.

Regla 4 — Nunca cambiar a ciegas

Si el pedido toca reservas, disponibilidad, slugs, pricing o auth:

revisar archivos relacionados,

revisar flujo completo,

revisar contratos de respuesta,

revisar dependencias cruzadas.

Regla 5 — Preservar compatibilidad

No romper:

slugs existentes,

localStorage actual,

links públicos,

contratos usados por pantallas existentes,

API_BASE,

auth actual,

CORS funcional.

Regla 6 — Si cambia el contrato, cambiar ambos lados

Si se modifica una respuesta del backend, Antigravity debe actualizar todos los consumidores frontend afectados en la misma intervención.

Regla 7 — Si cambia DB, formalizar migración

Todo cambio estructural debe pasar por:

schema.prisma

migración

validación de seed si corresponde

documentación del impacto

Regla 8 — Documentar archivos tocados

Cada entrega debe indicar exactamente:

qué archivos cambió,

por qué,

qué comportamiento nuevo queda,

qué riesgo queda pendiente.

Regla 9 — Priorizar consolidación antes que expansión

Mientras exista drift entre:

schema,

rutas,

frontend,

pricing,

booking,
Antigravity debe priorizar consolidar base antes de sumar features grandes.

Regla 10 — Mantener este archivo vivo

Si un cambio altera arquitectura, contratos, rutas, flujos o prioridades, Antigravity debe proponer también la actualización de MASTER_PLAN_ANTIGRAVITY.md.