# Frontend — Arquitectura y Optimizaciones

## Stack
- React + TypeScript + Vite
- TanStack Table v8
- Desplegado en Vercel

---

## Despliegue en Vercel

- **`.npmrc`** — `legacy-peer-deps=true` para resolver conflicto de peer deps entre eslint@10 y eslint-plugin-react-hooks
- **`vercel.json`** — rewrite `/(.*) → /index.html` para SPA routing (evita 404 en refresh directo)

---

## DataTable

Componente genérico en `src/components/table/DataTable.tsx` que soporta dos modos:

### Modo client-side (default)
TanStack Table filtra, pagina y ordena en memoria con todos los datos cargados. Usado en tablas pequeñas: parámetros, ciudades, usuarios, bitácora, etc.

### Modo server-side
Se activa pasando la prop `serverSide`. TanStack mantiene el estado de paginación y filtros, pero delega la ejecución al servidor. Usado en **PostePage** y **EventoPage**.

```typescript
serverSide?: {
  total: number;                                              // total registros en el servidor
  onPageChange: (page: number, pageSize: number) => void;    // al cambiar página
  onFilterChange: (columnId: string, value: string) => void; // al cambiar filtro (debounce 300ms)
}
```

### Props relevantes

| Prop | Default | Descripción |
|------|---------|-------------|
| `initialPageSize` | 25 | Tamaño de página inicial |
| `hasPaginated` | true | Mostrar controles de paginación |
| `serverSide` | — | Activa modo server-side |

### Comportamiento de carga
- **Primera carga** (`data === null`): muestra skeleton completo
- **Cambio de página** (`data !== null` + `loading`): muestra overlay semitransparente con spinner sobre los datos anteriores, sin parpadeo

---

## Paginación server-side

### Columnas filtrables por página

Solo columnas con `accessorKey` son filtrables. Las booleanas y de fecha tienen `enableColumnFilter: false`.

**PostePage:**
- `name` → `WHERE poste.name ILIKE '%valor%'`

**EventoPage:**
- `description` → `WHERE evento.description ILIKE '%valor%'`
- `poste` → `WHERE poste.name ILIKE '%valor%'`

### Export con datos completos
Los botones de export llaman a `exportPostes()` / `exportEventos()` con `?export=true`, obteniendo todos los registros independientemente de la página activa. El DataTable no interviene en el export.

---

## Página de inicio (Dashboard)

Usa el endpoint `/api/dashboard` dedicado que devuelve solo los campos mínimos necesarios para el mapa y las KPIs (`DashboardEvento`, `DashboardPoste`), evitando los JOINs pesados de los endpoints completos.

La carga se hace una única vez al entrar a la página — no hay auto-refresh automático.
