# Build and install the Windows desktop for personal use

Updated: 2026-11-20. `npm run build:windows` in `packages/desktop` creates a self-contained
Windows x64 NSIS installer with the shell, locally built engine and cockpit, production
dependencies, Node.js, RTK OSS and the WASM Repo Map assets. The installed app does not download
its engine at startup.

## 1. Prepare the build machine

Building requires Node.js 20+, Git for Windows, Rust stable with the MSVC toolchain, Windows
build tools and WebView2. Install the repository and desktop dependencies separately:

```powershell
npm ci
npm ci --prefix packages/desktop
```

The root install covers four workspaces, excluding the desktop CLI. Keep both lockfiles. Rust
and the Node.js build toolchain are only needed on the build machine; the desktop uses WebView2
at runtime. A user still needs Git and a logged-in agent CLI to run real coding tasks.

## 2. Clean generated output deliberately

Inspect the exact paths before deleting output. Confirm each is ignored, contains no tracked
files, and is not used by a running process. Restrict cleanup to generated output in this checkout:

| Path | Content | When safe to remove |
| --- | --- | --- |
| `packages/work/dist/` | Compiled engine, declarations and bundled dependencies | Before rebuilding; a linked desktop must not depend on it during cleanup |
| `packages/work/web/dist/` | Compiled cockpit and font assets | Before rebuilding the cockpit |
| `.tmp/desktop-builds/` | Isolated Cargo targets and intermediate bundles | After processes using those builds have exited |
| `.tmp/desktop-artifacts/` | Installer copies from earlier builds | When the earlier installers are no longer needed |
| `.tmp/desktop-stage/` | Temporary engine packaging trees | When no packaging process is running |
| `.tmp/rtk-engine-*/` | Engine verification fixtures | After the corresponding smoke test has finished |

Do not use a blanket `git clean -fdx` or delete `.tmp/` wholesale: it can contain branch backups,
QA evidence and unrelated work. Preserve `.git/`, source, lockfiles, `.agents/`, `.ai/onni/` and
the user's `~/.onni/` state. Removing task data is not build cleanup. Historical design records
under `.ai/specs/` are retained.

## 3. Verify and build the engine

Run the repository gates from its root, in this order:

```powershell
npm run typecheck
npm test
npm run test:unit
npm run build
npm run test:package
```

`typecheck` first builds the service. The full build writes the cockpit to
`packages/work/web/dist/` and checks the packable file list. `test:package` installs the tarball
into a separate consumer and exercises its CLI and WASM navigation. Server and unit suites stay
server-free and browser-free. UI/browser checks are separate.

Run Windows process fixtures with host access: a sandbox can block CIM or process termination.
If a package test times out, inspect its install and process logs; do not extend deadlines or
skip it just to produce an installer. Keep actual gate results with the build evidence.

## 4. Build the NSIS installer

```powershell
npm run build:windows --prefix packages/desktop
```

The script stages a production-only engine, adds the pinned, checksum-verified RTK OSS binary,
and bundles that tree with Node.js. It uses an isolated target under `.tmp/desktop-builds/` and
copies the final installer to:

```text
.tmp/desktop-artifacts/<version>-<commit>[-dirty]-<timestamp>/OnniCode_<version>_x64-setup.exe
```

`build:windows` owns desktop version increments: each successful build advances one tenth
(`0.4.0` to `0.5.0`, for example). It updates the desktop npm manifests, Tauri config and Cargo
manifests together and restores the previous version if packaging fails. Do not edit versions
by hand. The engine's `@onni/work` version is separate; the cockpit footer reports the running
engine's version. `-dev` identifies an engine running from a source checkout.

An installer built from uncommitted source carries `-dirty` in its artifact directory. Record
the revision, working-tree status, gate results and installer SHA-256 with that build. This is
a local package, not a commit, tag, published release or automatic update.

## 5. Verify the result

Use the installer path printed by the build. Compute its checksum with
`Get-FileHash -Algorithm SHA256`, inspect the generated NSIS manifest, and confirm it includes
`engine/node.exe`, `engine/node_modules/@onni/work/dist/index.js`, cockpit assets, RTK's
executable and licenses, and the Repo Map bundle, grammars and notices.

For a separate staged-engine consumer smoke test, after building run:

```powershell
npm run verify:engine --prefix packages/desktop
```

That command creates `.tmp/rtk-engine-*/verification.json` and verifies RTK and Repo Map using
staged assets. It stages a new engine tree and can download the pinned RTK release at build time.
It does not install the desktop app; keep that distinction in the verification report.

## 6. Install and select the intended engine

Run the printed setup executable when ready to install. Launch OnniCode and confirm the cockpit
reaches its local engine. For a mock task smoke check, use an isolated test home and
`ONNI_DRY_RUN=1`; without dry-run mode a prompt containing `mock:slow` is just a real agent task.

Engine resolution is: an existing `ONNI_DESKTOP_ENTRY`, then the checkout selected under
`~/.onni/versions/current`, then the engine bundled beside the desktop executable. A previous
`onni link --use` continues to override a newly installed engine. Check that selection when an
installed update appears to show old code.

Linking is optional for development:

```powershell
node packages/work/dist/index.js link . --use
```

Keep a linked checkout in place and rebuild it after edits. Reinstalling the desktop does not
clear projects, tasks or engine selection. This packaging workflow does not run the installer
automatically.
