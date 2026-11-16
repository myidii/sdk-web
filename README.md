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
