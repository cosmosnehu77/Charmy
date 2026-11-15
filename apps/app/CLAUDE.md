# apps/app

Dueño: `@daniace`. Vite + React + TypeScript, Tailwind v4, shadcn/ui, TanStack Query y Zustand (PLAN.md §1.1).

```bash
pnpm dev --filter @charmy/app      # http://localhost:5173
pnpm check --filter @charmy/app    # tipos, pruebas y compilación (también compila @charmy/ui)
```

- `VITE_API_URL` es la URL base de la API con `/api/v1`. En `pnpm dev` apunta al mock (`.env.development`):
  levantarlo con `pnpm --filter @charmy/contracts-api mock`. Para la API local, `.env.development.local`.
  Pasar del mock a la API real es solo cambiar esa variable.
- Una sola vista, Relieve (`src/relieve/`): indicadores por provincia, En vivo y Tu zona (#262, #276). Tu zona
  reúsa las piezas de la consulta, el calendario, el contexto y el reporte con los colores de `.tema-relieve`.
- Consulta (`src/consulta/`): área, fechas y filtros. Lógica pura en `consulta.ts`; estado en `src/estado/consulta.ts`
  (con `hoy` inyectado). `/hotspots` se pide con `Accept: application/geo+json`. Serie y confianza van a la API;
  potencia y momento del día se filtran en el navegador (el contrato v0 no los recibe).
- El navegador habla solo con nuestra API. Nunca con FIRMS, Meteomatics ni Copernicus.
- Colores, tipografías y rampas salen de `@charmy/ui`. Nada de colores sueltos en el código.
- Charmy se usa con `@charmy/charmy` (`<Charmy mood outfit size say />`). No se redibuja.
- Si una fuente falla, esa parte se muestra como no disponible y el resto sigue (ver `Seguro`).
- Componentes de shadcn en `src/components/ui/`; estado global en `src/estado/`; acceso a la API en `src/lib/`.
- Textos en español, en segunda persona. El aviso de emergencias (`AvisoEmergencias`) queda siempre visible.
- Mapa: `src/relieve/MapaRelieve.tsx`, MapLibre v6 con el estilo oscuro de OpenFreeMap, sin clave, cargado con `lazy`.
  El worker se registra con `setWorkerUrl` (Vite); sin eso el mapa queda en blanco. Terra Draw (`src/mapa/dibujo.ts`)
  dibuja el área de Tu zona. `src/mapa/` guarda solo lo compartido: límites, nombres en español, área e imagen.
- jsdom no tiene WebGL: en las pruebas `MapaRelieve` se reemplaza con `vi.mock`; lo visual se revisa en el navegador.
