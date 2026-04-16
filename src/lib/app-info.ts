export const APP_NAME = "Apilot"
export const APP_VERSION = __APP_VERSION__
export const GIT_HASH = __GIT_HASH__
export const GIT_BRANCH = __GIT_BRANCH__
export const BUILD_TIME = __BUILD_TIME__
export const IS_CI = __CI__
export const CI_RUN_NUMBER = __CI_RUN_NUMBER__
export const GITHUB_URL = "https://github.com/Yuerchu/openapi-advance"

export function getBuildLabel(): string {
  if (IS_CI && CI_RUN_NUMBER) return `build #${CI_RUN_NUMBER}`
  if (GIT_HASH) return GIT_HASH
  return "dev"
}
