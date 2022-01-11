import { expect, describe, it } from '@jest/globals';
import nock from 'nock';

import * as lieutenant from './lieutenant';

const lieutenantConfig = {
  lieutenantURL: 'https://lieutenant.example.com',
  lieutenantToken: 'mock-api-token',
};
const lieutenantResponse = {
  id: 'c-cluster-id-1234',
  tenant: 't-tenant-id-1234',
  displayName: 'Test cluster 1234',
  dynamicFacts: {
    fact: '1',
    fact2: '2',
  },
  facts: {
    cloud: 'none',
    distribution: 'k3d',
    'lieutenant-instance': 'example-com',
  },
  gitRepo: {
    deployKey: 'ssh-rsa AAAAB...',
    hostKeys: 'git.example.com ssh-rsa AAAAB...',
    type: 'auto',
    url: 'ssh://git@git.example.com/cluster-catalogs/c-cluster-id-1234.git',
  },
};

describe('src/commodore/lieutenant', () => {
  describe('LieutenantError', () => {
    it('has message and statusCode', () => {
      const e = new lieutenant.LieutenantError('test', 500);
      expect(e.message).toBe('test');
      expect(e.statusCode).toBe(500);
    });
    it('has correct instance type', () => {
      const e = new lieutenant.LieutenantError('test', 500);
      expect(e instanceof lieutenant.LieutenantError).toBe(true);
    });
    it('subclasses Error', () => {
      const e = new lieutenant.LieutenantError('test', 500);
      expect(e instanceof Error).toBe(true);
    });
  });

  describe('queryLieutenant', () => {
    it('returns clusterInfo for successful request', async () => {
      const scope = nock('https://lieutenant.example.com', {
        reqheaders: {
          Authorization: 'Bearer mock-api-token',
        },
      })
        .get('/clusters/c-cluster-id-1234')
        .reply(200, lieutenantResponse);
      const resp = await lieutenant.queryLieutenant(
        lieutenantConfig,
        'clusters',
        'c-cluster-id-1234'
      );
      expect(resp).toStrictEqual(lieutenantResponse);
      expect(scope.isDone()).toBe(true);
    });
    it('rejects the promise on a 404 from the API', async () => {
      const scope = nock('https://lieutenant.example.com', {
        reqheaders: {
          Authorization: 'Bearer mock-api-token',
        },
      })
        .get('/clusters/c-cluster-id-1234')
        .reply(404, { reason: 'Cluster not found' });
      const resp = lieutenant.queryLieutenant(
        lieutenantConfig,
        'clusters',
        'c-cluster-id-1234'
      );
      await expect(resp).rejects.toStrictEqual(
        new lieutenant.LieutenantError('Cluster not found', 404)
      );
      expect(scope.isDone()).toBe(true);
    });
    it('rejects the promise on a 500 from the API', async () => {
      const scope = nock('https://lieutenant.example.com', {
        reqheaders: {
          Authorization: 'Bearer mock-api-token',
        },
      })
        .get('/clusters/c-cluster-id-1234')
        .reply(500, 'Internal server error');
      const resp = lieutenant.queryLieutenant(
        lieutenantConfig,
        'clusters',
        'c-cluster-id-1234'
      );
      await expect(resp).rejects.toStrictEqual(
        new lieutenant.LieutenantError('Query error', 500)
      );
      expect(scope.isDone()).toBe(true);
    });
    it('rejects the promise on a request error', async () => {
      const scope = nock('https://lieutenant.example.com', {
        reqheaders: {
          Authorization: 'Bearer mock-api-token',
        },
      })
        .get('/clusters/c-cluster-id-1234')
        .replyWithError('request error');
      const resp = lieutenant.queryLieutenant(
        lieutenantConfig,
        'clusters',
        'c-cluster-id-1234'
      );
      await expect(resp).rejects.toStrictEqual(new Error('request error'));
      expect(scope.isDone()).toBe(true);
    });
  });
});
