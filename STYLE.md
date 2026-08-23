---
title: Backend Code Style and Conventions
---

This guide covers the backend in `server/`, root server build scripts, and `test/server/`.

## TypeScript Migration

- Write new modules and substantial rewrites in TypeScript.
- Do not convert unrelated legacy JavaScript solely because a file is touched.
- Preserve CommonJS interoperability during the migration. Existing `require` and `module.exports` code must continue to work with emitted TypeScript modules.
- Do not introduce ESM or a TypeScript runtime loader. Node runs the JavaScript emitted to `dist-server/`.
- Never edit `dist-server/` directly; regenerate it with `npm run build:server`.

## Types

- Use strict, explicit types in TypeScript files. Avoid `any`.
- Use `unknown` for untrusted input and narrow it before use.
- Prefer type guards and validation over type assertions. A narrow assertion is acceptable when interoperating with untyped legacy JavaScript.
- Use `type` for unions, intersections, tuples, mapped types, and composed types.
- Use `interface` for object contracts intended to be extended.
- Avoid `enum`; use objects, maps, or union types instead.

## Code Structure

- Use descriptive names. Boolean names should describe state, such as `isLoaded` or `hasError`.
- Prefer named exports for new TypeScript modules and utilities.
- Keep modules focused and avoid duplication.
- Prefer pure functions for stateless utilities.
- Retain classes where they model existing stateful server responsibilities, such as managers, models, and services.

## Tests and Verification

- Follow the existing Mocha, Chai, and Sinon test style.
- Keep backend tests under `test/server/` and use `*.test.js` until a test is deliberately migrated.
- Run `npm test` before submitting backend changes. It builds `dist-server/` and runs the server test suite.
- Run `npm run build:server` when verifying the generated server output without running tests.

## Formatting

- Follow `.prettierrc`: no semicolons, single quotes, no trailing commas, and a 400-character print width.
- Keep comments focused on non-obvious behavior, compatibility constraints, or external API details.
