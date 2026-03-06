# Reference Next.js App Router (TypeScript)

This folder is **copy/paste reference code** for the PixelCraft system in a real Next.js App Router codebase.

It intentionally does **not** integrate into `admin-cms` (CRA). It’s here so you can lift it into your Next.js app.

## Included

- Admin routes: template list + template editor shell
- Storefront route: user personalization editor shell
- Core client components (stubs) that demonstrate:
  - Fabric setup (client-only)
  - Editable vs locked objects for user editor
  - Serialize/deserialize hooks

## Dependencies (for the Next.js app)

```bash
npm i fabric
```

If you implement server-side rendering/export inside Next.js:

```bash
npm i canvas pdfkit
```

## Where the real logic lives

Use the already-built reference modules in:

- `admin-cms/src/PixelCraft/editor/*` (admin editor libs)
- `admin-cms/src/PixelCraft/user-editor/*` (restricted user editor helpers)
- `admin-cms/src/PixelCraft/render/*` (print pipeline examples)

