import yaml from 'js-yaml';
import { readFile, unlink } from 'fs/promises';

import { expect, describe, it } from 'vitest';

import { defaultExtraConfig } from './index';
import * as util from './util';
import { Facts } from './types';
import { getFixturePath } from '../test/util';

/* Check whether `facts` has any non-null field */
function hasFact(facts: Facts): boolean {
  return (
    facts.distribution !== null || facts.cloud !== null || facts.region !== null
  );
}

describe('src/commodore/util', () => {
  describe('parseFileName() with default regex patterns', () => {
    it('returns empty fact on no match', () => {
      const f = util.parseFileName(
        'test.yaml',
        defaultExtraConfig.distributionRegex,
        defaultExtraConfig.cloudRegionRegex,
        []
      );
      expect(hasFact(f)).toBe(false);
    });

    it.each`
      file                                   | fact
      ${'distribution/dist.yml'}             | ${{ distribution: 'dist', cloud: null, region: null }}
      ${'cloud/cloud.yml'}                   | ${{ distribution: null, cloud: 'cloud', region: null }}
      ${'cloud/cloud/region.yml'}            | ${{ distribution: null, cloud: 'cloud', region: 'region' }}
      ${'cloud/cloud2/region2.yaml'}         | ${{ distribution: null, cloud: 'cloud2', region: 'region2' }}
      ${'cloud/cloud/params.yml'}            | ${{ distribution: null, cloud: 'cloud', region: null }}
      ${'cloud/cloud2/params.yaml'}          | ${{ distribution: null, cloud: 'cloud2', region: null }}
      ${'cloud/cloud/params/param.yml'}      | ${{ distribution: null, cloud: 'cloud', region: null }}
      ${'cloud/cloud/foo/bar.yml'}           | ${{ distribution: null, cloud: 'cloud', region: null }}
      ${'cloud/cloud2/foo/bar/buzz.yaml'}    | ${{ distribution: null, cloud: 'cloud2', region: null }}
      ${'cloud/cloud2/foo/.yaml'}            | ${{ distribution: null, cloud: 'cloud2', region: null }}
      ${'cloud/cloud//.yml'}                 | ${{ distribution: null, cloud: 'cloud', region: null }}
      ${'cloud/cloud/.yml'}                  | ${{ distribution: null, cloud: null, region: null }}
      ${'cloud/cloudnt/.yaml'}               | ${{ distribution: null, cloud: null, region: null }}
      ${'cloud/cloud/notyml.json'}           | ${{ distribution: null, cloud: null, region: null }}
      ${'cloud/cloud/notyml.sh'}             | ${{ distribution: null, cloud: null, region: null }}
      ${'distribution/dist/cloud/cloud.yml'} | ${{ distribution: 'dist', cloud: 'cloud', region: null }}
    `('returns $fact for $file', ({ file, fact }) => {
      const f = util.parseFileName(
        file,
        defaultExtraConfig.distributionRegex,
        defaultExtraConfig.cloudRegionRegex,
        defaultExtraConfig.ignoreValues
      );

      expect(f.distribution).toBe(fact.distribution);
      expect(f.cloud).toBe(fact.cloud);
      expect(f.region).toBe(fact.region);
    });
  });
  describe('parseFileName()', () => {
    it('works with regexp from string', () => {
      const regexpstr = '^distribution\\/(?<distribution>\\w+).ya?ml';
      const f = util.parseFileName(
        'distribution/dist.yaml',
        new RegExp(regexpstr),
        /^cloud\/(?<cloud>\w+).yaml/,
        []
      );
      expect(hasFact(f)).toBe(true);
      expect(f.distribution).toBe('dist');
      expect(f.cloud).toBeNull();
      expect(f.region).toBeNull();
    });
    it('treats capture group distribution.cloud as optional', () => {
      const f = util.parseFileName(
        'distribution/dist.yml',
        /^distribution\/(?<distribution>\w+)\.yml$/,
        /^cloud\/(\w+)\.yaml$/,
        []
      );
      expect(hasFact(f)).toBe(true);
      expect(f.distribution).toBe('dist');
      expect(f.cloud).toBeNull();
      expect(f.region).toBeNull();
    });
    it('treats capture group cloud.region as optional', () => {
      const f = util.parseFileName(
        'cloud/cloud.yml',
        /^distribution\/(?<distribution>\w+)\.yml$/,
        /^cloud\/(?<cloud>\w+)\.yml$/,
        []
      );
      expect(hasFact(f)).toBe(true);
      expect(f.distribution).toBeNull();
      expect(f.cloud).toBe('cloud');
      expect(f.region).toBeNull();
    });
  });

  describe('writeYamlFile()', () => {
    it('writes a file from a flat object', async () => {
      const fname = '/tmp/util-spec-1.yaml';
      await util.writeYamlFile(fname, { a: 1, b: '2', c: 3.0 });

      const contentStr = (await readFile(fname)).toString();
      const content: any = yaml.load(contentStr) as any;
      expect('a' in content).toBe(true);
      expect('b' in content).toBe(true);
      expect('c' in content).toBe(true);
      expect(content.a).toBe(1);
      expect(content.b).toBe('2');
      expect(content.c).toBe(3.0);

      await unlink(fname);
    });
    it('writes a file from a nested object', async () => {
      const fname = '/tmp/util-spec-2.yaml';
      await util.writeYamlFile(fname, { a: { b: '2', c: 3.0 } });

      const contentStr = (await readFile(fname)).toString();
      const content: any = yaml.load(contentStr) as any;
      expect('a' in content).toBe(true);
      expect('b' in content.a).toBe(true);
      expect('c' in content.a).toBe(true);
      expect(content.a.b).toBe('2');
      expect(content.a.c).toBe(3.0);

      await unlink(fname);
    });
  });

  describe('pruneObject()', () => {
    it.each`
      orig                         | expected
      ${{ a: 1 }}                  | ${{ a: 1 }}
      ${{ a: 1, b: 2 }}            | ${{ a: 1, b: 2 }}
      ${{ a: 1, b: null }}         | ${{ a: 1 }}
      ${{ a: 1, b: undefined }}    | ${{ a: 1 }}
      ${{ a: null, b: undefined }} | ${{}}
    `('transforms $orig into $expected', ({ orig, expected }) => {
      const o = util.pruneObject(orig);
      expect(o).toStrictEqual(expected);
    });
  });

  describe('mergeConfig()', () => {
    it.each`
      a                          | b                          | merged
      ${{ a: 1 }}                | ${{ b: 2 }}                | ${{ a: 1, b: 2 }}
      ${{ a: 1 }}                | ${{ a: 2 }}                | ${{ a: 2 }}
      ${{ a: /^$/ }}             | ${{ a: /^a$/ }}            | ${{ a: /^a$/ }}
      ${{ a: { a: 1 } }}         | ${{ a: { b: 2 } }}         | ${{ a: { a: 1, b: 2 } }}
      ${{ a: { a: 1, c: [1] } }} | ${{ a: { b: 2, c: [2] } }} | ${{ a: { a: 1, b: 2, c: [1, 2] } }}
    `('merges $a and $b', ({ a, b, merged }) => {
      const m = util.mergeConfig(a, b);
      expect(m).toStrictEqual(merged);
    });
  });

  describe('parseGlobalRepoConfig()', () => {
    it('returns an empty config if no file exists', async () => {
      const c = await util.parseGlobalRepoConfig(
        getFixturePath('parseGlobalRepoConfig/1')
      );
      expect(c).toStrictEqual({});
    });
    it('returns an empty config if `commodore` not set in renovate.json', async () => {
      const c = await util.parseGlobalRepoConfig(
        getFixturePath('parseGlobalRepoConfig/2')
      );
      expect(c).toStrictEqual({});
    });
    it('returns an empty config if `commodore.extraConfig` not set in renovate.json', async () => {
      const c = await util.parseGlobalRepoConfig(
        getFixturePath('parseGlobalRepoConfig/3')
      );
      expect(c).toStrictEqual({});
    });
    it('returns the contents of `commodore.extraConfig` in renovate.json', async () => {
      const c = await util.parseGlobalRepoConfig(
        getFixturePath('parseGlobalRepoConfig/4')
      );
      expect(c).toStrictEqual({ extraParameters: { a: 1 } });
    });
  });
});
