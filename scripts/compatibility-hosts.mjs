/** Published host generations exercised by the installed-package matrix. */
export const hosts = [
  ['v015-rc1', '0.1.5-rc.1'],
  ['v015-rc2', '0.1.5-rc.2'],
  ['v016-alpha1', '0.1.6-alpha.1'],
  ['v016-alpha2', '0.1.6-alpha.2'],
  ['v017', '0.1.7-alpha.1'],
  ['v017-alpha2', '0.1.7-alpha.2'],
  ['v017-rc1', '0.1.7-rc.1'],
  ['v017-rc2', '0.1.7-rc.2'],
  ['v020-rc2', '0.2.0-rc.2'],
  ['v021-alpha1', '0.2.1-alpha.1'],
].map(([id, version]) => ({ id, version }))
