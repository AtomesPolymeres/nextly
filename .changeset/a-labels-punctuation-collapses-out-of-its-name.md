---
"@nextlyhq/adapter-drizzle": patch
"@nextlyhq/adapter-mysql": patch
"@nextlyhq/adapter-postgres": patch
"@nextlyhq/adapter-sqlite": patch
"@nextlyhq/admin": patch
"@nextlyhq/admin-css": patch
"@nextlyhq/blocks-engine": patch
"@nextlyhq/blocks-react": patch
"@nextlyhq/builder": patch
"create-nextly-app": patch
"@nextlyhq/eslint-config": patch
"@nextlyhq/eslint-plugin": patch
"@nextlyhq/module-specifiers": patch
"nextly": patch
"@nextlyhq/plugin-form-builder": patch
"@nextlyhq/plugin-mcp": patch
"@nextlyhq/plugin-page-builder": patch
"@nextlyhq/plugin-sdk": patch
"@nextlyhq/plugin-seo": patch
"@nextlyhq/prettier-config": patch
"@nextlyhq/storage-s3": patch
"@nextlyhq/storage-uploadthing": patch
"@nextlyhq/storage-vercel-blob": patch
"@nextlyhq/telemetry": patch
"@nextlyhq/tsconfig": patch
"@nextlyhq/ui": patch
---

The Schema Builder translated a Label into its auto-derived Name one
character at a time: every space, apostrophe, period or colon became its own
underscore, so "phone no." named the field "phone*no*", "Author's: Note;"
became "author*s\_\_note*", and a punctuation-only label minted a name of pure
underscores. The derivation now follows the formatting rule the builder's
other name and slug derivations already apply: a run of anything that is not
a letter or a digit collapses to one underscore, and nothing dangles at
either end — "phone no." derives "phone_no". Clean names are untouched, and
the same fix reaches the collection slug, which derives through the same
function.
