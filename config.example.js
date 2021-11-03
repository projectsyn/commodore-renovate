module.exports = {
  endpoint: 'https://git.company.net/api/v4/',
  token: 'YOUR_GITLAB_TOKEN',
  platform: 'gitlab',
  onboardingConfig: {
    extends: ['config:base'],
    prConcurrentLimit: 5,
  },
  repositories: ['youraccount/yourrepo'],
  enabledManagers: ['commodore'],
  dryRun: 'true',
};
