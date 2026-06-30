# Dependency Stability Policy

This project intentionally pins critical build, ORM, and test dependencies to known-working versions.

## Current pinned baseline

- Node: `>=20.0.0 <23`
- pnpm: `10.4.1`
- TypeScript: `5.6.3`
- Prisma ORM / Client: `6.19.3`
- Vite: `5.4.21`
- Vitest: `2.1.9`
- React: `18.3.1`

## Prisma policy

Do not upgrade Prisma to v7 as part of normal feature work. Prisma v7 is a major migration and should be handled in a dedicated migration patch after the application is stable.

Recommended future patch name:

```txt
Patch 30 — Prisma 7 Migration
```

That patch should review generator output, driver adapters, Neon connection behavior, and all `@prisma/client` imports.

## pnpm build scripts

The project allows build scripts for known required native/runtime packages only:

```txt
@prisma/client
@prisma/engines
prisma
esbuild
sharp
canvas
bcrypt
bufferutil
```

If `pnpm install` shows ignored build scripts, run:

```bash
pnpm approve-builds
pnpm prisma generate
pnpm check
```

## Upgrade workflow

For dependency upgrades:

1. Upgrade one group at a time.
2. Run `pnpm install`.
3. Run `pnpm prisma generate` if Prisma-related packages changed.
4. Run `pnpm check`.
5. Run `pnpm test`.
6. Run `pnpm build`.
7. Commit package and lockfile together.

Avoid mixing dependency upgrades with feature patches.
