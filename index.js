// This file is a workaround for an Expo CLI + Monorepo + Android Release build bug.
// During the release build, Expo CLI runs the bundler with process.cwd() set to the workspace root,
// but passes the entryFile relative to the app root (i.e. just "index.js").
// Metro then resolves "index.js" against the workspace root.
// This file catches that resolution and redirects it back into the actual mobile app.
import './apps/mobile/index.js';
