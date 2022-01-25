import { loadFixture } from '../test/util';
import { extractPackageFile, parseImageDependency } from './index';
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


describe('manager/commodore/index/parseImageDependency', () => {
  const table = [
    {
      image: {
        registry: 'quay.io',
        repository: 'bitnami/kubectl',
        tag: '1.21.2',
      },
      depName: 'quay.io/bitnami/kubectl',
      currentValue: '1.21.2',
    },
    {
      image: {
        repository: 'quay.io/bitnami/kubectl',
        tag: '1.21.2',
      },
      depName: 'quay.io/bitnami/kubectl',
      currentValue: '1.21.2',
    },
    {
      image: {
        registry: 'quay.io',
        image: 'bitnami/kubectl',
        tag: '1.21.2',
      },
      depName: 'quay.io/bitnami/kubectl',
      currentValue: '1.21.2',
    },
    {
      image: {
        registry: 'quay.io',
        image: 'bitnami/kubectl',
        version: '1.21.2',
      },
      depName: 'quay.io/bitnami/kubectl',
      currentValue: '1.21.2',
    },
    {
      image: {
        image: 'bitnami/kubectl:1.21.2',
      },
      noImage: true,
    },
    {
      image: {
        registry: 'quay.io',
        tag: '1.21.2',
      },
      noImage: true,
    },
    {
      image: 'blub',
      noImage: true,
    },
    {
      noImage: true,
    },
  ]
  describe.each(table)('parseImageDependency', (tc) => {
    if (tc?.noImage) {
      expect(parseImageDependency(tc.image)).toBeNull()
    } else {
      expect(parseImageDependency(tc.image)?.depName).toBe(tc.depName)
      expect(parseImageDependency(tc.image)?.currentValue).toBe(tc.currentValue)
    }
  })
})
