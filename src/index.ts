import api from 'renovate/dist/manager/api.js';
import * as commodore from './commodore';

api.set('commodore', commodore);

// Patch renovate option validation to accept `commodore.extraConfig`
// parameter.
const options_1 = require('renovate/dist/config/options');
let options = options_1.getOptions();
options.push({
  name: 'extraConfig',
  description: 'Extra configuration file for commodore manager',
  type: 'string',
  default: '',
});

require('renovate/dist/renovate.js');
