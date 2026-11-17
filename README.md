# MYIDII browser SDKs

| Package | |
| --- | --- |
| [`@myidii/web`](packages/web) | Any website, with a bundler or a script tag |
| [`@myidii/react`](packages/react) | A hook and a button for React |

Servers use [`@myidii/node`](https://github.com/myidii/sdk-server).

## Working on this repo

```sh
npm install
npm run build
npx changeset        # describe your change for the changelog
```

Releases are automatic: merging the "Version packages" pull request publishes to npm with provenance.
`examples/demo` is a small app that uses both SDKs end to end.

## Testing

```sh
npm test                 # unit tests for both packages (Vitest, happy-dom), against the source
npm run test:coverage    # the same, and fails under the coverage thresholds in vitest.config.mts
npm run test:packaging   # builds, packs and tests the tarballs exactly as npm would publish them
```

`test:packaging` installs the packed tarballs into a throwaway app in a temp dir and checks them with publint
and Are the Types Wrong, imports them from Node as ESM and CJS, typechecks a TypeScript consumer with
`moduleResolution` set to `bundler` and to `node16`, and bundles a small React app with esbuild. Then Playwright
loads `dist/myidii.min.js` with a script tag and the React bundle in Chromium, against a stand-in scan page on
its own origin. Every request is answered locally; the only network use is the npm install of React. Run
`npx playwright install chromium` once first. Pass `-- --skip-build` to reuse `dist`, or `-- --keep` to keep
the temp dir.

CI runs all three on every pull request and push to main, and the release workflow runs them before it
publishes.
