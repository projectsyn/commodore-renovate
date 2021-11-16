import yaml from 'js-yaml';
import { readFile } from 'fs/promises';

import { loadFixture } from '../test/util';
import { expect, describe, it } from '@jest/globals';

import * as inv from './inventory';
import { cacheDir } from './util';
import { Facts } from './types';

describe('src/commodore/inventory', () => {
  describe('writeFactsFile()', () => {
    it('writes facts to file', async () => {
      const f = new Facts();
      f.distribution = 'dist';
      f.cloud = 'cloud';
      f.region = 'region';
      const factsPath = await inv.writeFactsFile('ck', f);

      expect(factsPath).toBe(`${cacheDir()}/ck-facts.yaml`);

      const resStr = (await readFile(factsPath)).toString();
      const res = yaml.load(resStr);

      expect('parameters' in res).toBe(true);
      expect('facts' in res.parameters).toBe(true);
      expect('distribution' in res.parameters.facts).toBe(true);
      expect('dist_version' in res.parameters.facts).toBe(true);
      expect('cloud' in res.parameters.facts).toBe(true);
      expect('region' in res.parameters.facts).toBe(true);
      expect(res.parameters.facts.distribution).toBe('dist');
      expect(res.parameters.facts.dist_version).toBe('1.20');
      expect(res.parameters.facts.cloud).toBe('cloud');
      expect(res.parameters.facts.region).toBe('region');
    });
  });
});
