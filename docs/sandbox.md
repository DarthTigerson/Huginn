Huginn is a TypeScript/Electron app (Vite + React) built with `electron-vite`.

- install deps: `npm ci`
- run tests: `npm test` (vitest)
- build: `npm run build`
- there is no lint script; TypeScript project references are in `tsconfig*.json`

Node version: this repo pins Node 20 (`.nvmrc`, matches `.github/workflows/release.yml`'s
`node-version: 20`). `@electron/rebuild`/`node-abi` print an `EBADENGINE` warning wanting
Node >=22.12 -- that's just a warning, `npm run rebuild` and `npm run build` both work fine
under 20; don't chase it.

The sandbox runs as a different user than the host, so PATH, npm's own cache config, and
every tool below that defaults to a path under `$HOME` don't point at the host's copies.
`node_toolchain`, `npm_cache`, `electron_cache`, `node_gyp_cache`, `electron_gyp_cache` and
`gcc_toolchain` are mounted read-only at the same absolute paths they have on the host (see
`.box/mounts.json`, per-machine and gitignored), so set these before any node/npm command:

    export PATH="$(echo /home/*/.nvm/versions/node/v20*)/bin:$PATH"
    export PATH="$(dirname "$(find /home -maxdepth 8 -type d -name 'x86-64--glibc--stable-*' 2>/dev/null | head -1)")/bin:$PATH"
    export electron_config_cache="$(echo /home/*/.cache/electron)"
    export npm_config_devdir="$(echo /home/*/.cache/node-gyp)"
    export CC=x86_64-buildroot-linux-gnu-gcc
    export CXX=x86_64-buildroot-linux-gnu-g++

(the glob handles there being more than one /home/*/ dir -- the sandbox user's own plus
the mounted host user's; `gcc_toolchain` lives inside this repo's own `.box/deps/`, at
whatever absolute path the host happens to clone the repo to, so `find` locates it instead
of guessing that path)

`npm_cache` is mounted read-only too, but `npm ci` needs to `mkdtemp` inside its
`_cacache/tmp`, which a read-only mount refuses -- copy it to a writable directory first
rather than pointing `NPM_CONFIG_CACHE` at the mount directly:

    cp -r "$(echo /home/*/.npm)" ~/npm-cache
    export NPM_CONFIG_CACHE=~/npm-cache

registry.npmjs.org is **not** on the network allowlist (`.box/kit/spec.yaml`), so
`npm ci`/`npm install` only work against what's already in the mounted cache -- run
`npm ci --offline`. If a package is missing from the cache (e.g. package-lock.json changed
since the host last installed), that 403s; say so rather than trying to work around it,
or ask for registry.npmjs.org to be allowlisted if a real install is required.

### Electron and native builds (node-pty)

With `electron_cache` mounted and `electron_config_cache` set above, `npm ci --offline`
extracts `node_modules/electron/dist` with no network too.

`node-pty` (the terminal in `src/components/Chat/Chat.tsx`) is a native addon. Its install
script (`node scripts/prebuild.js || node-gyp rebuild`) first tries to download a prebuilt
binary from GitHub -- not reachable here -- then falls back to compiling with `node-gyp`,
which needs a C++ compiler the sandbox image doesn't ship and no apt mirror can supply.
`gcc_toolchain` is a portable toolchain vendored for exactly this; with `CC`/`CXX`/`PATH`
set above, `npm ci --offline` builds `node-pty` against plain Node. `npm_config_devdir` set
above points node-gyp at the mounted `node_gyp_cache` too, so it skips fetching Node's
headers from nodejs.org (also not on the allowlist).

`npm run rebuild` (`electron-rebuild -f -w node-pty`) rebuilds `node-pty` against
Electron's ABI instead of Node's, and looks up its own Electron-headers cache at
`~/.electron-gyp` -- derived from `$HOME` rather than an env var node-gyp reads, so point
`HOME` at the mounted `electron_gyp_cache`'s parent for that one command:

    HOME="$(dirname "$(echo /home/*/.electron-gyp)")" npm run rebuild

`gcc_toolchain` is `x86-64--glibc--stable-2024.05-1` from toolchains.bootlin.com (GCC
13.3.0, glibc 2.39), fetched into `.box/deps/` with its checksum verified and
`./relocate-sdk.sh .` run once from that exact path -- Buildroot toolchains hardcode their
extraction path internally, so moving the directory needs that step re-run there. Picked
that release rather than the newest (glibc 2.41) since a `.node` file linked against a
newer glibc than the sandbox image ships would fail to load with `GLIBC_2.xx not found`;
2.39 matches Ubuntu 24.04. Validated end to end on the host: built `node-pty` with
`CC`/`CXX` pointed at it, then `require()`d the result and spawned a real pty with it.
