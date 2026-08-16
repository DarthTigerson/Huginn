// Docker container names can't contain '/', so a plain indexOf split is
// unambiguous — no separator-escaping needed the way git paths need one.
const DOCKER_LOGS_PREFIX = 'docker-logs://'

export function isDockerLogsTab(path: string): boolean {
  return path.startsWith(DOCKER_LOGS_PREFIX)
}

export function buildDockerLogsPath(containerId: string, containerName: string): string {
  return `${DOCKER_LOGS_PREFIX}${containerId}/${containerName}`
}

export function parseDockerLogsPath(path: string): { containerId: string; containerName: string } {
  const rest = path.slice(DOCKER_LOGS_PREFIX.length)
  const slashIndex = rest.indexOf('/')
  return { containerId: rest.slice(0, slashIndex), containerName: rest.slice(slashIndex + 1) }
}
