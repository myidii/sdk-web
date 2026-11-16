# Changesets

Every change that should reach npm comes with a short note: `npx changeset`, pick the packages, pick
patch, minor or major, and write one line a developer would want to read in the changelog.

On main, the release workflow keeps a "Version packages" pull request open with the next versions and
changelogs. Merging it publishes to npm (with provenance) and tags the release on GitHub.
