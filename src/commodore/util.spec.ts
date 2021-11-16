import yaml from 'js-yaml';
import { readFile } from 'fs/promises';

import { loadFixture } from '../test/util';
import { expect, describe, it } from '@jest/globals';

import * as util from './util';
import { Facts } from './types';

//TODO(sg): use default config values for the patterns
const distributionRegex =
  /^distribution\/(?<distribution>[^\/]+)(?:\/cloud\/(?<cloud>.+)\.ya?ml|\.ya?ml)$/;
const cloudRegionRegex =
  /^cloud\/(?<cloud>[^\/]+)(?:\/(?<region>.+)\.ya?ml|\.ya?ml)$/;

describe('src/commodore/util', () => {
  describe('hasFact()', () => {
    it('returns false for empty Facts', () => {
      expect(util.hasFact(new Facts())).toBe(false);
    });
    it('returns true for facts with distribution', () => {
      const f = new Facts();
      f.distribution = 'x';
      expect(util.hasFact(f)).toBe(true);
    });
    it('returns true for facts with cloud', () => {
      const f = new Facts();
      f.cloud = 'x';
      expect(util.hasFact(f)).toBe(true);
    });
    it('returns true for facts with region', () => {
      const f = new Facts();
      f.region = 'x';
      expect(util.hasFact(f)).toBe(true);
    });
    it('returns true for facts with cloud & region', () => {
      const f = new Facts();
      f.cloud = 'a';
      f.region = 'x';
      expect(util.hasFact(f)).toBe(true);
    });
    it('returns true for facts with distribution & region', () => {
      const f = new Facts();
      f.distribution = 'a';
      f.region = 'x';
      expect(util.hasFact(f)).toBe(true);
    });
    it('returns true for facts with distribution & cloud', () => {
      const f = new Facts();
      f.distribution = 'a';
      f.cloud = 'x';
      expect(util.hasFact(f)).toBe(true);
    });
    it('returns true for facts with distribution, cloud & region', () => {
      const f = new Facts();
      f.distribution = 'a';
      f.cloud = 'x';
      f.region = 'm';
      expect(util.hasFact(f)).toBe(true);
    });
  });

  describe('parseFileName() with default regex patterns', () => {
    it('returns empty fact on no match', () => {
      const f = util.parseFileName(
        'test.yaml',
        distributionRegex,
        cloudRegionRegex,
        []
      );
      expect(util.hasFact(f)).toBe(false);
    });

    it.each`
      file                                   | fact
      ${'distribution/dist.yml'}             | ${{ distribution: 'dist', cloud: null, region: null }}
      ${'cloud/cloud.yml'}                   | ${{ distribution: null, cloud: 'cloud', region: null }}
      ${'cloud/cloud/region.yml'}            | ${{ distribution: null, cloud: 'cloud', region: 'region' }}
      ${'distribution/dist/cloud/cloud.yml'} | ${{ distribution: 'dist', cloud: 'cloud', region: null }}
    `('returns $fact for $file', ({ file, fact }) => {
      const f = util.parseFileName(
        file,
        distributionRegex,
        cloudRegionRegex,
        []
      );

      expect(util.hasFact(f)).toBe(true);
      expect(f.distribution).toBe(fact.distribution);
      expect(f.cloud).toBe(fact.cloud);
      expect(f.region).toBe(fact.region);
    });
    it('works with regexp from string', () => {
      const regexpstr = '^distribution\\/(?<distribution>\\w+).ya?ml';
      const f = util.parseFileName(
        'distribution/dist.yaml',
        new RegExp(regexpstr),
        /^cloud\/(?<cloud>\w+).yaml/,
        []
      );
      expect(util.hasFact(f)).toBe(true);
      expect(f.distribution).toBe('dist');
    });
  });

  describe('writeYamlFile()', () => {
    it('writes a file from a flat object', async () => {
      const fname = '/tmp/util-spec-1.yaml';
      await util.writeYamlFile(fname, { a: 1, b: '2', c: 3.0 });

      const contentStr = (await readFile(fname)).toString();
      const content = yaml.load(contentStr);
      expect('a' in content).toBe(true);
      expect('b' in content).toBe(true);
      expect('c' in content).toBe(true);
      expect(content.a).toBe(1);
      expect(content.b).toBe('2');
      expect(content.c).toBe(3.0);
    });
    it('writes a file from a nested object', async () => {
      const fname = '/tmp/util-spec-1.yaml';
      await util.writeYamlFile(fname, { a: { b: '2', c: 3.0 } });

      const contentStr = (await readFile(fname)).toString();
      const content = yaml.load(contentStr);
      expect('a' in content).toBe(true);
      expect('b' in content.a).toBe(true);
      expect('c' in content.a).toBe(true);
      expect(content.a.b).toBe('2');
      expect(content.a.c).toBe(3.0);
    });
  });

  describe('mapToObject()', () => {
    it.each`
      map                                  | obj
      ${new Map().set('a', 1)}             | ${{ a: 1 }}
      ${new Map().set('a', 1).set('b', 2)} | ${{ a: 1, b: 2 }}
    `('transforms a Map() into an object', ({ obj, map }) => {
      const o = util.mapToObject(map);
      expect(o).toStrictEqual(obj);
    });
  });
});
