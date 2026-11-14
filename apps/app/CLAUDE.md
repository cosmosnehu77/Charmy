# apps/app

Dueño: `@daniace`. Vite + React + TypeScript, Tailwind v4, shadcn/ui, TanStack Query y Zustand (PLAN.md §1.1).

```bash
pnpm dev --filter @charmy/app      # http://localhost:5173
pnpm check --filter @charmy/app    # tipos, pruebas y compilación (también compila @charmy/ui)
```

- `VITE_API_URL` es la URL base de la API con `/api/v1`. En `pnpm dev` apunta al mock (`.env.development`):
  levantarlo con `pnpm --filter @charmy/contracts-api mock`. Para la API local, `.env.development.local`.
  Pasar del mock a la API real es solo cambiar esa variable.
- Consulta (`src/consulta/`): área, fechas y filtros. Lógica pura en `consulta.ts`; estado en `src/estado/consulta.ts`
  (con `hoy` inyectado). `/hotspots` se pide con `Accept: application/geo+json`. Serie y confianza van a la API;
  potencia y momento del día se filtran en el navegador (el contrato v0 no los recibe).
- El navegador habla solo con nuestra API. Nunca con FIRMS, Meteomatics ni Copernicus.
- Colores, tipografías y rampas salen de `@charmy/ui`. Nada de colores sueltos en el código.
- Charmy se usa con `@charmy/charmy` (`<Charmy mood outfit size say />`). No se redibuja.
- Si una fuente falla, esa parte se muestra como no disponible y el resto sigue (ver `EstadoApi`).
- Componentes de shadcn en `src/components/ui/`; estado global en `src/estado/`; acceso a la API en `src/lib/`.
- Textos en español, en segunda persona. El aviso de emergencias (`AvisoEmergencias`) queda siempre visible.
- Mapa (`src/mapa/`): MapLibre v6, un solo motor con dos perfiles en `perfiles.ts` (2D positron sin relieve; 3D
  liberty con relieve Terrarium). Todo sin clave. Se cambia de perfil con `setStyle` + `transformStyle`; las capas
  propias (`capas.ts`) y Terra Draw se vuelven a crear en cada `style.load` para sobrevivir al cambio. El worker se registra con `setWorkerUrl`
  (Vite); sin eso el mapa queda en blanco. `Mapa.tsx` se carga con `lazy` para no frenar el primer dibujo.
- jsdom no tiene WebGL: en las pruebas `Mapa` se reemplaza con `vi.mock`; lo visual se revisa en el navegador.
