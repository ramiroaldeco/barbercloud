# Reglas permanentes para subir BarberCloud a GitHub

## Repositorios oficiales

- **Backend:** `barbercloud`
- **Frontend:** `barbercloudFRONTEND`

## Regla principal

Nunca mezclar frontend y backend en un mismo repositorio.

## Mapeo obligatorio

### Todo lo que vaya al repo `barbercloud` (BACKEND)
Incluye solamente:
- servidor
- API
- rutas
- controladores
- middlewares
- modelos
- Prisma / schema / migraciones
- lógica de negocio
- autenticación
- integraciones backend
- variables y configuración del servidor
- webhooks
- servicios internos del backend

Ejemplos típicos:
- `server.js`
- `app.js` backend
- `routes/`
- `controllers/`
- `middlewares/`
- `prisma/`
- `schema.prisma`
- `members.js`
- endpoints `/api/...`

---

### Todo lo que vaya al repo `barbercloudFRONTEND` (FRONTEND)
Incluye solamente:
- landing
- panel visual
- HTML
- CSS
- JS del cliente
- componentes UI
- imágenes del frontend
- vistas públicas
- vistas del dashboard
- assets visuales

Ejemplos típicos:
- `index.html`
- `admin_v2.html`
- `admin_v2.js`
- `landing.css`
- imágenes
- mockups
- logos
- archivos de interfaz

## Prohibiciones

- No subir archivos frontend al repo backend
- No subir archivos backend al repo frontend
- No hacer un solo commit mezclando ambos lados si corresponden a repos distintos
- No asumir que todo cambio va al mismo repo

## Si una tarea toca frontend y backend

Cuando una funcionalidad afecta ambos lados:

1. separar cambios de backend
2. subir backend a `barbercloud`
3. separar cambios de frontend
4. subir frontend a `barbercloudFRONTEND`
5. confirmar qué se subió a cada repo

## Checklist obligatorio antes de pushear

Antes de hacer push, verificar siempre:

- ¿Este archivo corre del lado servidor o del lado cliente?
- ¿Es lógica de API o interfaz visual?
- ¿Pertenece al panel/landing o al backend?
- ¿Estoy mezclando archivos de ambos lados?
- ¿Cada repo quedó limpio y coherente?

## Formato de trabajo esperado

Si te pido “subí los cambios a GitHub”, debés:

1. revisar qué archivos cambiaron
2. clasificarlos en frontend o backend
3. separarlos por repo
4. hacer push al repo correcto
5. decirme exactamente:
   - qué archivos subiste al backend
   - qué archivos subiste al frontend
   - en qué repositorio quedó cada cosa

## Regla final

**Backend siempre a `barbercloud`.**  
**Frontend siempre a `barbercloudFRONTEND`.**  
**Nunca mezclar.**