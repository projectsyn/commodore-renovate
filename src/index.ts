#!/usr/bin/env node
import { existsSync, rmSync } from 'fs';
import api from 'renovate/dist/modules/manager/api.js';
import { logger } from 'renovate/dist/logger';

import * as commodore from './commodore';
import * as commodoreDocker from './commodore-docker';
import * as commodoreHelm from './commodore-helm';
import { globalRepos } from './commodore/util';

// NOTE(sg): This import pulls in our extra renovate module declarations
// which are defined in `src/renovate.d.ts`.
import './renovate';

api.set('commodore', commodore);
api.set('commodore-docker', commodoreDocker);
api.set('commodore-helm', commodoreHelm);

// Patch renovate option validation to accept `commodore.extraConfig`
// parameter.
import { getOptions } from 'renovate/dist/config/options';
let options = getOptions();
options.push({
  name: 'extraConfig',
  description: 'Extra configuration file for commodore manager',
  type: 'string',
  default: '',
});
options.push({
  name: 'globalRepoURL',
  description: 'URL of the global repo for the commodore manager',
  type: 'string',
  default: '',
});
options.push({
  name: 'tenantId',
  description:
    'Tenant ID. This must match the tenant the repo is belonging to.',
  type: 'string',
  default: '',
});
options.push({
  name: 'lieutenantURL',
  description:
    'URL of Lieutenant API. Used to fetch cluster facts when renovating tenant repos.',
  type: 'string',
  default: '',
});
options.push({
  name: 'lieutenantTokenEnvVar',
  description: 'Environment variable to read the Lieutenant API token from.',
  type: 'string',
  default: 'LIEUTENANT_API_TOKEN',
});

function cleanupGlobalRepos() {
  logger.info('cleaning up global defaults repos');
  globalRepos.forEach((repo, globalRepoURL) => {
    logger.info(
      { repo: repo.dir },
      `deleting global defaults ${globalRepoURL}`
    );
    if (existsSync(repo.dir)) {
      rmSync(repo.dir, { recursive: true });
    }
  });
}
// Run `cleanupGlobalRepos` at nodejs process exit with the `exit-hook`
// package since we can't patch Renovate's `globalFinalize()` anymore.
import exitHook from 'exit-hook';
exitHook(cleanupGlobalRepos);

require('renovate/dist/renovate.js');
