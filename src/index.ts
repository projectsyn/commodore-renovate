#!/usr/bin/env node
import { existsSync, rmSync } from 'fs';
import api from 'renovate/dist/manager/api.js';
import { logger } from 'renovate/dist/logger';

import * as commodore from './commodore';
import { globalRepos } from './commodore/util';

api.set('commodore', commodore);

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

// Patch renovate finalizer, we need the require() here despite what the TS
// hint indicates. However, seems that suggestions cannot be suppressed with
// typescript hints (e.g. @ts-ignore).
// @ts-ignore
const init = require('renovate/dist/workers/global/initialize');
const origGlobalFinalize: any = init.globalFinalize;
function patchedGlobalFinalize(config: any) {
  globalRepos.forEach((repo, tenant_id) => {
    logger.info(
      { repo: repo.dir },
      `deleting cloned global defaults for ${tenant_id}`
    );
    if (existsSync(repo.dir)) {
      rmSync(repo.dir, { recursive: true });
    }
  });
  origGlobalFinalize(config);
}
init.globalFinalize = patchedGlobalFinalize;

require('renovate/dist/renovate.js');
