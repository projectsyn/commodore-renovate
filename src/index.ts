import api from 'renovate/dist/manager/api.js';
import * as commodore from './commodore';

api.set('commodore', commodore);
require('renovate/dist/renovate.js');
