module.exports = {
  endpoint: 'https://api.github.com/',
  // GH access token is owned by vshn-renovate
  token: process.env.RENOVATE_GITHUB_TOKEN,
  platform: 'github',
  username: 'vshn-renovate',
  gitAuthor: 'Renovate Bot <tech+renovate@vshn.ch>',
  onboardingConfig: {
    extends: ['config:recommended'],
    prConcurrentLimit: 5,
  },
  branchPrefix: 'commodore-renovate/',
  // NOTE(sg): I picked component-rook-ceph as the canary component for no
  // reason other than it tends to have at least 1 open PR.
  repositories: ['projectsyn/component-rook-ceph'],
  enabledManagers: ['commodore-docker', 'commodore-helm'],
  prHourlyLimit: 10,
  dryRun: 'full',
  separateMinorPatch: true,
  separateMultipleMajor: true,
  allowedCommands: ['^make gen-golden(|-all)$'],
  forkProcessing: 'enabled',
  // NOTE(sg): We should have `commodore` in the CI job when we get to the
  // point where we run `yarn dev`.
  customEnvVariables: {
    COMMODORE_CMD: 'commodore',
    COMPILE_CMD: 'commodore component compile . $(commodore_args)',
    PS1: '',
  },
  logLevelRemap: [
    {
      matchMessage: 'Request Error: cannot parse url',
      newLogLevel: 'warn',
    },
  ],
};
