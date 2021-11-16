import { loadFixture } from '../test/util';
import { extractPackageFile } from './index';
import { expect, describe, it } from '@jest/globals';

const params1 = loadFixture('1/params.yml');
const kube2 = loadFixture('2/kubernetes.yml');
const invalid3 = loadFixture('3/params.yml');

describe('src/commodore/index', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here', 'no.yml')).toBeNull();
    });
    it('extracts component versions', () => {
      const res = extractPackageFile(params1, '1/params.yml');
      expect(res).not.toBeNull();
      if (res) {
        const deps = res.deps;
        expect(deps).toMatchSnapshot();
        expect(deps).toHaveLength(6);
      }
    });
    it('returns no component version for files without components', () => {
      expect(extractPackageFile(kube2, '2/kubernetes.yml')).toBeNull();
    });
    it('returns null for invalid yaml', () => {
      expect(extractPackageFile(invalid3, '3/params.yml')).toBeNull();
    });
  });
});
