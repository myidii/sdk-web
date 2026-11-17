#!/usr/bin/env bash
# Publishes every package whose version isn't on npm yet, through npm trusted publishing: no token anywhere,
# so npm exchanges this workflow's GitHub identity for a short-lived publish credential. Then pushes the
# release tags and creates a GitHub release for each, with that version's changelog.
# Run by .github/workflows/release.yml once the "Version packages" pull request is merged.
set -euo pipefail

# Any token, even an empty or placeholder one, makes npm skip trusted publishing.
unset NODE_AUTH_TOKEN NPM_TOKEN
NPM_CONFIG_USERCONFIG="$(mktemp)"
export NPM_CONFIG_USERCONFIG
printf 'registry=https://registry.npmjs.org/\n' > "$NPM_CONFIG_USERCONFIG"

before="$(git tag | sort)"
npx changeset publish
git push origin --tags

# The folder of a workspace package, from its name.
dir_of() {
  node -e '
    const fs = require("fs"), path = require("path");
    const dirs = require("./package.json").workspaces.flatMap((w) =>
      w.endsWith("/*") ? fs.readdirSync(w.slice(0, -2)).map((d) => path.join(w.slice(0, -2), d)) : [w]);
    for (const d of dirs) {
      try { if (require(path.resolve(d, "package.json")).name === process.argv[1]) console.log(d); } catch {}
    }' "$1"
}

for tag in $(comm -13 <(echo "$before") <(git tag | sort)); do
  pkg="${tag%@*}"
  version="${tag##*@}"
  notes="$(awk -v heading="## $version" '$0 == heading { found = 1; next } /^## / { if (found) exit } found' "$(dir_of "$pkg")/CHANGELOG.md")"
  gh release create "$tag" --title "$tag" --notes "${notes:-See CHANGELOG.md.}"
done
