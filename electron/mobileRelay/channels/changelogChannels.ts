import { registerChannel } from '../dispatch'
import { getChangelogForVersion, getChangelogReleases } from '../../changelog'

export function registerChangelogRelayChannels(): void {
  registerChannel('changelog:getForVersion', (version: string) => getChangelogForVersion(version))
  registerChannel('changelog:getReleases', () => getChangelogReleases())
}
