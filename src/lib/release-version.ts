/** Embedded into the static export so production/source parity is auditable. */
export const RELEASE_VERSION =
  process.env.NEXT_PUBLIC_BUILD_VERSION ||
  process.env.CF_PAGES_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  "local-uncommitted";
