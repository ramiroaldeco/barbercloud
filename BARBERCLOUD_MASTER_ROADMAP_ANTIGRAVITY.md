## ESTADO ACTUAL PRIORITARIO / BLOQUEO TÉCNICO

Antes de seguir avanzando con nuevas fases, hay un bloqueo técnico actual que debe resolverse primero.

Estado actual real:
- el nuevo flujo del modal de “Nuevo turno manual” ya está bastante alineado con la lógica deseada
- ya se muestran mejor los barberos
- ya aparecen sus avatares/fotos
- el orden del flujo está más cerca de lo correcto

Pero el paso de “Horario disponible” sigue sin funcionar.

Problema exacto detectado en producción:
- al intentar cargar horarios disponibles, el frontend muestra “Sin horarios disponibles” o error
- en consola aparece un error de backend / Prisma
- el error real es:
  `Invalid prisma.barberBlockedTime.findMany() invocation`
- causa:
  la tabla `public.BarberBlockedTime` no existe actualmente en la base de datos de producción

Esto significa que:
- el motor de horarios no está pudiendo consultar correctamente los bloqueos o disponibilidad
- el problema no es necesariamente que no haya horarios
- el problema actual es técnico y debe corregirse antes de seguir avanzando

## PRIORIDAD INMEDIATA
No avanzar a nuevas funcionalidades hasta resolver esto.

Primero hay que:
1. alinear Prisma + base de datos de producción
2. crear/aplicar correctamente la tabla y relaciones faltantes (`BarberBlockedTime` y lo que corresponda)
3. verificar que el endpoint de horarios disponibles deje de devolver error
4. verificar que el modal de “Nuevo turno manual” cargue horarios reales de cada barbero

Solo después de eso seguir con las fases siguientes.
# BARBERCLOUD — PROMPT MAESTRO DE PRODUCTO + ROADMAP + REGLAS DE IMPLEMENTACIÓN

Quiero que, a partir de ahora, todo el trabajo sobre BarberCloud siga este documento como guía principal de producto, lógica, prioridades y orden de implementación.

No quiero que improvises ni que cambies el foco según cada iteración.
Quiero que sigas este roadmap en orden, con criterio de producto real, y que no avances a nuevas fases si la fase actual no está realmente estable.

---

# 1. CONTEXTO DEL PRODUCTO

BarberCloud es un SaaS para barberías y peluquerías.

Tiene dos caras bien distintas:

1. **Landing del SaaS**
   - orientada a dueños de barberías
   - función comercial / marketing
   - ya fue trabajada y no es prioridad principal ahora

2. **Producto real**
   - panel interno del dueño de la barbería
   - vista pública de reserva del cliente, accesible por link o QR propio de cada barbería
   - lógica real de servicios, barberos, horarios, reservas, pagos, agenda y estadísticas

A partir de ahora, el foco principal debe estar en el **producto interno y la reserva pública real**, no en seguir tocando la landing salvo retoques menores al final.

---

# 2. REGLAS DE NEGOCIO NO NEGOCIABLES

## 2.1 Fee de la plataforma
El fee de la plataforma:
- solo debe aparecer para el cliente al momento del pago
- NO debe aparecer en ninguna vista del panel de la barbería
- NO debe aparecer en estadísticas
- NO debe aparecer en ingresos por servicio
- NO debe aparecer en ingresos por barbero
- NO debe aparecer en ingresos mensuales
- NO debe aparecer en ingresos totales del negocio

La barbería solo debe ver sus propios ingresos reales.

Separación de conceptos:
- `servicePrice` = precio real del servicio de la barbería
- `platformFee` = comisión de la plataforma
- `totalChargedToClient` = servicePrice + platformFee
- `barbershopRevenue` = lo que realmente cuenta como ingreso de la barbería

Todas las estadísticas del panel deben usar solo `barbershopRevenue` o `servicePrice`, nunca `platformFee`.

---

## 2.2 Cada turno pertenece a un barbero
Un turno no debe ser “de la barbería” en abstracto.
Todo turno debe pertenecer a un barbero específico.

---

## 2.3 La disponibilidad depende del barbero
La lógica principal del sistema debe ser **barber-centric**.

No quiero que el sistema dependa de una “plantilla horaria general” como lógica principal.
La disponibilidad real debe depender del barbero.

---

## 2.4 Cada servicio tiene duración real
Cada servicio debe tener una duración en minutos.

Ejemplos:
- Corte = 30 min
- Corte + Barba = 45 min
- Color = 90 min

La duración del servicio determina el espacio real que ocupa en la agenda.

---

## 2.5 Los slots no van por bloques fijos
No quiero una grilla rígida de horarios fijos que redondee a `:00` o `:30`.

Quiero esta lógica exacta:
- si un turno termina a las 09:15, el siguiente puede arrancar a las 09:15
- si un turno termina a las 10:45, el siguiente puede arrancar a las 10:45
- los horarios disponibles deben poder empezar exactamente cuando termina el turno anterior
- el motor debe avanzar según la duración real del servicio seleccionado

Ejemplo:
- Turno 1: 08:00 a 08:30 (Corte)
- Turno 2: 08:30 a 09:15 (Corte + Barba)
- El siguiente horario disponible debe poder empezar a las 09:15

No quiero redondeos ni una grilla fija escondida.

---

## 2.6 Un barbero solo debe aparecer si aplica
Un barbero solo debe mostrarse como opción válida si:
- está activo
- realiza el servicio elegido
- está habilitado para reservas
- trabaja en la fecha seleccionada

---

# 3. EXPERIENCIA DEL CLIENTE FINAL

La página pública de cada barbería:
- se accede por link o QR propio de esa barbería
- debe ser atractiva, moderna y rápida
- debe mostrar el logo de la barbería (cargado anteriormente por la barberia)
- debe hacer que reservar un turno sea muy simple
- debe tener loading claro si el servidor está despertando o si la data está cargando
- debe llevar al pago de seña lo más rápido posible

No quiero una página pública genérica o floja.
Quiero una experiencia rápida, confiable y visualmente prolija.

---

# 4. EXPERIENCIA DEL DUEÑO DE LA BARBERÍA

El dueño necesita un panel donde pueda:
- cargar su logo
- gestionar servicios
- gestionar barberos
- configurar horarios por barbero
- cargar turnos manualmente
- ver agenda
- ver clientes
- configurar seña
- ver estadísticas reales con gráficos
- comparar rendimiento por miembro
- entender su negocio

---

# 5. REPOSITORIOS GITHUB — REGLA PERMANENTE

Hay dos repositorios separados y NO deben mezclarse.

## Repositorio backend
`barbercloud`

Todo lo que sea backend va aquí:
- servidor
- API
- rutas
- controladores
- middlewares
- lógica de negocio
- Prisma
- schema
- migraciones
- integraciones backend
- webhooks
- servicios internos

## Repositorio frontend
`barbercloudFRONTEND`

Todo lo que sea frontend va aquí:
- landing
- panel visual
- HTML
- CSS
- JS del navegador
- assets
- logos
- imágenes
- UI del admin
- UI pública del cliente

## Regla obligatoria
Nunca mezclar frontend y backend en el mismo repo.
Si una tarea toca ambos lados:
1. separar cambios backend
2. subir backend a `barbercloud`
3. separar cambios frontend
4. subir frontend a `barbercloudFRONTEND`
5. reportar qué archivos quedaron en cada repo

---

# 6. ESTADO ACTUAL / FOCO ACTUAL

La landing del SaaS ya está suficientemente avanzada.
No es la prioridad principal ahora.

El foco actual es:
- panel interno
- miembros
- disponibilidad
- reservas
- vista pública del cliente
- pagos
- agenda
- estadísticas

Además, hubo varios problemas reales previos con:
- endpoints 500
- Prisma / Neon desalineado
- agenda que no cargaba
- miembros con errores
- selector de horarios que no funcionaba

Por lo tanto:
**no se debe avanzar a nuevas fases si la fase actual no está estable en producción**.

---

# 7. ROADMAP MAESTRO POR FASES

---

## FASE 0 — CERRAR DEFINICIONES DE PRODUCTO

### Objetivo
Congelar las decisiones importantes para no cambiar la lógica cada dos pasos.

### Dejar cerrado:
- el sistema es barber-centric
- la disponibilidad depende del barbero
- la duración del servicio define los horarios
- el fee no aparece en estadísticas del negocio
- la reserva pública entra por link o QR propio
- la página pública debe ser rápida, atractiva y con logo
- la seña debe ser configurable por el dueño

### Resultado esperado
Un único criterio de producto, sin contradicciones entre panel, reserva pública y pagos.

---

## FASE 1 — ESTABILIZACIÓN TÉCNICA OBLIGATORIA

### Objetivo
Arreglar primero lo roto antes de seguir metiendo features.

### Prioridades
- endpoints sin 400/500
- agenda cargando
- miembros funcionando
- creación manual de turnos funcionando
- endpoint de disponibilidad funcionando
- frontend sin crashes
- producción estable

### También entra acá
Estados de carga / loading:
- si el server está despertando, mostrar loading claro
- si la data tarda, mostrar spinner / skeleton / loading visual prolijo
- esto debe existir tanto en:
  - panel admin
  - vista pública del cliente

### Definition of done
- no hay errores 400/500 en flujos principales
- no hay errores de consola
- agenda carga
- miembros carga
- disponibilidad responde bien
- crear turno manual funciona
- la página no parece rota mientras Render despierta

---

## FASE 2 — IDENTIDAD DE BARBERÍA + MÓDULO MIEMBROS

### Objetivo
Construir la estructura real del negocio.

### Incluye
- que el dueño pueda cargar el logo de su barbería
- usar el logo en:
  - panel admin
  - vista pública del cliente
- CRUD completo de barberos
- foto/avatar de cada barbero
- rol del barbero
- estado activo/inactivo
- asignación de servicios por barbero
- horarios individuales por barbero

### UI de horarios del barbero
Quiero una configuración mejor que la actual.
Cada barbero debe poder marcar:
- día abierto/cerrado
- horario corrido
- horario cortado
- una o varias franjas por día

Ejemplo:
- martes: 08:00–12:00 y 16:00–21:00
- miércoles: 16:00–20:00

### Definition of done
- cada barbería tiene logo
- cada barbero tiene perfil completo
- cada barbero tiene servicios asignados
- cada barbero tiene horario real configurable y usable

---

## FASE 3 — MOTOR REAL DE DISPONIBILIDAD

### Objetivo
Construir el corazón lógico del sistema.

### Regla principal
Los horarios disponibles deben calcularse según:
- servicio
- barbero
- fecha
- turnos ya ocupados
- duración real del servicio

### Lógica exacta
1. se elige barbero, servicio y fecha
2. se buscan las franjas horarias del barbero ese día
3. se buscan los turnos ocupados de ese barbero ese día
4. se generan slots que entren completos
5. si un turno termina a 09:15, el siguiente puede empezar a 09:15
6. no hay bloques fijos artificiales

### Necesidades técnicas
- usar duración real del servicio
- evitar superposición real
- usar `startAt` / `endAt` o una estructura equivalente robusta
- devolver horarios disponibles reales

### Definition of done
- el endpoint de availability devuelve horarios correctos
- no hay redondeos falsos
- los slots cambian según la duración del servicio

---

## FASE 4 — NUEVO TURNO MANUAL EN EL PANEL

### Objetivo
Que el dueño cargue turnos manuales con la lógica real del negocio.

### Flujo exacto que quiero
1. Cliente
   - nombre y apellido
2. Servicio
3. Barbero
   - mostrar solo barberos que hagan ese servicio
   - mostrar su foto/avatar
4. Fecha
   - permitir solo fechas coherentes con el barbero elegido
5. Horario
   - mostrar solo horarios reales disponibles
6. Teléfono
   - opcional o según se defina

### Reglas
- el admin no puede escribir una hora cualquiera
- el horario debe salir automáticamente del motor de disponibilidad
- el flujo manual debe respetar la misma lógica real que la reserva pública

### Definition of done
- crear un turno manual es rápido, claro y coherente
- no se pueden generar turnos fuera de la disponibilidad real

---

## FASE 5 — PÁGINA PÚBLICA DE RESERVA DEL CLIENTE

### Objetivo
Hacer una experiencia de reserva rápida, atractiva y confiable.

### Debe incluir
- logo de la barbería
- identidad visual propia
- carga rápida
- loading claro si el server está despertando
- flujo simple de reserva
- servicios
- barberos
- fotos de barberos
- horarios reales disponibles
- paso a pago de seña

### Flujo público recomendado
1. Servicio
2. Barbero
3. Fecha
4. Horario
5. Datos del cliente
6. Pago de seña

O, si la lógica pide otra variante, siempre respetando:
- el horario depende del barbero
- el horario depende del servicio
- el horario depende de la fecha

### Definition of done
- reservar es rápido
- el cliente ve una página linda y clara
- el cliente solo ve opciones válidas
- la UX no parece improvisada

---

## FASE 6 — PAGOS DE SEÑA + FEE

### Objetivo
Integrar el pago de reserva de manera rápida y clara.

### Debe permitir
- que el dueño configure la seña
- que la seña sea modificable desde el panel
- que el cliente pague:
  - seña
  - fee de plataforma
- que el flujo sea lo más corto y rápido posible

### Reglas
- el dueño define la seña
- el cliente paga seña + fee
- el fee nunca aparece en estadísticas del negocio
- el flujo debe ser natural dentro de la reserva pública

### Definition of done
- reservar y pagar seña es rápido
- el pago queda claro
- el fee queda separado correctamente

---

## FASE 7 — AGENDA OPERATIVA

### Objetivo
Que el negocio administre bien el día a día.

### Incluye
- agenda en lista
- agenda calendario
- filtros por barbero
- filtros por fecha
- filtros por estado
- reprogramación
- cancelación
- mejor visualización de turnos por miembro

### Definition of done
- la agenda sirve de verdad para trabajar todos los días

---

## FASE 8 — ESTADÍSTICAS REALES Y GRÁFICOS

### Objetivo
Dar visibilidad real del negocio.

### Debe incluir
- gráficos
- métricas por rango:
  - últimos 7 días
  - 1 mes
  - 1 año
- cortes realizados
- cortes por cada miembro
- cliente más frecuente
- cantidad de turnos cancelados
- total de turnos
- ingresos por servicio
- ingresos por barbero
- evolución temporal

### Reglas
- no mostrar fee de plataforma
- solo mostrar datos del negocio de la barbería

### Definition of done
- el dueño entiende su negocio con datos reales

---

## FASE 9 — PULIDO VISUAL TOTAL

### Objetivo
Dejar todo mucho más premium, moderno y llamativo.

### Incluye
- mejorar la UI general del panel
- mejorar la UI pública del cliente
- mejores loaders
- mejores cards
- mejores selects
- mejores gráficos visualmente
- mejores estados vacíos
- mejores microinteracciones
- branding más fuerte de cada barbería

### Definition of done
- el sistema se ve mucho más profesional y vendible

---

# 8. ORDEN ESTRICTO DE EJECUCIÓN

Quiero que sigas este orden y no te desvíes:

1. Fase 0
2. Fase 1
3. Fase 2
4. Fase 3
5. Fase 4
6. Fase 5
7. Fase 6
8. Fase 7
9. Fase 8
10. Fase 9

No quiero saltar a estadísticas, pagos o polish visual si todavía falla:
- members
- appointments
- availability
- creación de turno
- agenda

---

# 9. FORMA DE TRABAJO QUE QUIERO

Quiero que trabajes así:

## Antes de tocar una fase
- resumí qué entendiste de esa fase
- decime qué pantallas vas a tocar
- decime qué endpoints o modelos vas a tocar

## Durante la fase
- implementá solo lo que pertenece a esa fase
- no mezcles trabajo de 3 fases juntas
- no inventes cambios que no fueron pedidos

## Al cerrar una fase
Quiero que me devuelvas:
1. qué hiciste
2. qué archivos tocaste
3. qué backend tocaste
4. qué frontend tocaste
5. qué cambios hubo en DB / Prisma
6. qué repos actualizaste
7. commit SHA backend
8. commit SHA frontend
9. cómo validaste que funciona en producción

---

# 10. PROHIBICIONES

No quiero:
- seguir tocando la landing como foco principal
- avanzar a una fase nueva si la anterior sigue rota
- respuestas optimistas sin evidencia
- mezclar frontend y backend en un repo
- mocks lindos sin lógica real
- estadísticas antes de tener reservas estables
- pagos antes de tener disponibilidad estable
- agenda linda arriba de datos inconsistentes

---

# 11. RESULTADO FINAL ESPERADO

Quiero un sistema donde:

- cada barbería tenga identidad propia (logo, marca, link/QR)
- cada barbero tenga foto, servicios y horarios
- la disponibilidad sea real y dependa del barbero
- la reserva pública sea rápida, atractiva y simple
- el pago de seña sea rápido y configurable
- el panel tenga agenda útil
- el panel tenga estadísticas reales
- el fee de la plataforma quede invisible para la barbería
- todo se vea mucho más profesional

---

# 12. REGLA FINAL

A partir de ahora, seguí este roadmap como guía principal.

No avances a la siguiente fase hasta que la actual:
- funcione de verdad
- esté validada en producción
- no tenga errores críticos
- y yo te la apruebe

Primero base firme.
Después crecimiento.
No al revés.