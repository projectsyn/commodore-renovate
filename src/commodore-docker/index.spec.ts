import { loadFixture } from '../test/util';
import { extractPackageFile } from './index';
import { expect, describe, it } from '@jest/globals';

const params1 = loadFixture('1/params.yml');
const params2 = loadFixture('2/params.yml');
const params3 = loadFixture('3/params.yml');

describe('manager/commodore/index', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here', 'no.yml')).toBeNull();
    });
    it('extracts standard images', () => {
      const res = extractPackageFile(params1, '1/params.yml');
      expect(res).not.toBeNull();
      if (res) {
        const deps = res.deps;
        expect(deps).toMatchSnapshot();
        expect(deps).toHaveLength(4);
      }
    });
    it('returns no images for files without images', () => {
      expect(extractPackageFile(params2, '2/params.yml')).toBeNull();
    });
    it('returns images for non standard but common formats', () => {
      const res = extractPackageFile(params3, '3/params.yml');
      expect(res).not.toBeNull();
      if (res) {
        const deps = res.deps;
        expect(deps).toMatchSnapshot();
        expect(deps).toHaveLength(4);
      }
    });
  });
});
