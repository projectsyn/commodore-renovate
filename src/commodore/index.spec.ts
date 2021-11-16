import { loadFixture } from '../test/util';
import { extractPackageFile, defaultConfig } from './index';
import { expect, describe, it } from '@jest/globals';

const params1 = loadFixture('1/params.yml');
const kube2 = loadFixture('2/kubernetes.yml');
const invalid3 = loadFixture('3/params.yml');

describe('src/commodore/index', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      return expect(
        extractPackageFile('nothing here', 'no.yml', defaultConfig)
      ).resolves.toBeNull();
    });
    it('extracts component versions', async () => {
      const res = await extractPackageFile(
        params1,
        '1/params.yml',
        defaultConfig
      );
      expect(res).not.toBeNull();
      if (res) {
        const deps = res.deps;
        expect(deps).toMatchSnapshot();
        expect(deps).toHaveLength(6);
      }
    });
    it('returns no component version for files without components', () => {
      return expect(
        extractPackageFile(kube2, '2/kubernetes.yml', defaultConfig)
      ).resolves.toBeNull();
    });
    it('returns null for invalid yaml', () => {
      return expect(
        extractPackageFile(invalid3, '3/params.yml', defaultConfig)
      ).resolves.toBeNull();
    });
  });
});
