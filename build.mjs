import {build} from 'esbuild';
await build({entryPoints:['src/background.ts','src/content.ts','src/offscreen.ts','src/options.ts','src/popup.ts'],outdir:'extension',bundle:true,format:'iife',target:'chrome116',sourcemap:false});
await build({entryPoints:['src/core.ts','src/providers.ts','src/profiles.ts','src/model-display.ts','src/workflow.ts','src/library.ts','src/library-io.ts','src/db.ts'],outdir:'tests/built',bundle:true,format:'esm',platform:'node',target:'node22'});
