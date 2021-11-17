import yaml from 'js-yaml';
import { mkdir, readFile, unlink } from 'fs/promises';

import { expect, describe, it } from '@jest/globals';

import * as inv from './inventory';
import { cacheDir } from './util';
import { Facts } from './types';

beforeAll(async () => {
  await mkdir(cacheDir(), { recursive: true });
});

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
      const res: any = yaml.load(resStr) as any;

      expect('parameters' in res).toBe(true);
      expect('facts' in res.parameters).toBe(true);
      expect('distribution' in res.parameters.facts).toBe(true);
      expect('cloud' in res.parameters.facts).toBe(true);
      expect('region' in res.parameters.facts).toBe(true);
      expect(res.parameters.facts.distribution).toBe('dist');
      expect(res.parameters.facts.cloud).toBe('cloud');
      expect(res.parameters.facts.region).toBe('region');

      await unlink(factsPath);
    });
  });
});
