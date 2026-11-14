# apps/app

Dueño: `@daniace`. Vite + React + TypeScript, Tailwind v4, shadcn/ui, TanStack Query y Zustand (PLAN.md §1.1).

```bash
pnpm dev --filter @charmy/app      # http://localhost:5173
pnpm check --filter @charmy/app    # tipos, pruebas y compilación (también compila @charmy/ui)
```

- `VITE_API_URL` (ver `.env.example`) es la URL base de la API con `/api/v1`. Vacía = datos de muestra.
  Pasar del mock a la API real es solo cambiar esa variable.
- El navegador habla solo con nuestra API. Nunca con FIRMS, Meteomatics ni Copernicus.
- Colores, tipografías y rampas salen de `@charmy/ui`. Nada de colores sueltos en el código.
- Charmy se usa con `@charmy/charmy` (`<Charmy mood outfit size say />`). No se redibuja.
- Si una fuente falla, esa parte se muestra como no disponible y el resto sigue (ver `EstadoApi`).
- Componentes de shadcn en `src/components/ui/`; estado global en `src/estado/`; acceso a la API en `src/lib/`.
- Textos en español, en segunda persona. El aviso de emergencias (`AvisoEmergencias`) queda siempre visible.
