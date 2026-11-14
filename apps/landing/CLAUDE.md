# apps/landing: reglas para los agentes

Landing de Charmy en Astro, estática. Dueño: `@dimidio6` (carril E, por D-25). Cloudflare Pages publica
`apps/landing/dist` al entrar cambios en `main` (`deploy-web.yml`).

## Comandos

```bash
pnpm dev --filter @charmy/landing     # http://localhost:4321
pnpm check --filter @charmy/landing   # tipos (astro check), pruebas y compilación
pnpm --filter @charmy/landing preview # sirve dist/ como en producción
```

## Reglas

- Charmy se dibuja **solo** con `charmyHtml()` o `charmySvg()` de `@charmy/charmy/core`, al compilar. Nunca se copia
  su SVG. Estado y vestuario según la skill `charmy`: en la portada, `saluda` y `base`.
- Colores, tipografías y formas salen de `@charmy/ui` (`tokens.css`, `fonts.css`). Nada de valores sueltos.
- Sin Google Fonts ni scripts de terceros: todo se sirve desde el propio sitio.
- Textos en español, cortos y con voseo. Los textos finales llegan de F1-F1 (carril F); hasta entonces son provisorios.
- Página estática sin React. Si hace falta interacción, va con islas de Astro o con GSAP (tabla de PLAN.md).
- Las pruebas renderizan la página con el Container API de Astro (`test/portada.test.ts`).
- Toda animación de GSAP va dentro de `gsap.matchMedia()` con `(prefers-reduced-motion: no-preference)`.
