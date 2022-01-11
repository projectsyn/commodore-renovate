import { expect, describe, it } from '@jest/globals';
import nock from 'nock';

import { loadFixture } from '../test/util';

import * as httpsq from './https-query';

describe('src/commodore/https-query', () => {
  describe('httpsQuery', () => {
    it('returns body and statusCode for non-json response', async () => {
      const scope = nock('https://example.com')
        .get('/test')
        .reply(200, 'test body');
      const resp = await httpsq.httpsQuery('https://example.com/test', {});
      expect(resp.statusCode).toBe(200);
      expect(resp.data).toBe('test body');
      expect(resp.json).toBeNull();
      expect(scope.isDone()).toBe(true);
    });
    it('returns body, json and statusCode for json response', async () => {
      const scope = nock('https://example.com')
        .get('/json')
        .reply(200, { test: 'data' });
      const resp = await httpsq.httpsQuery('https://example.com/json', {});
      expect(resp.statusCode).toBe(200);
      expect(resp.data).toBe('{"test":"data"}');
      expect(resp.json).toStrictEqual({ test: 'data' });
      expect(scope.isDone()).toBe(true);
    });
    it('reassembles large responses', async () => {
      // XXX(sg): Doesn't actually test the reassembling functionality as nock
      // doesn't split the response into chunks regardless of its size.
      const largeJsonStr = loadFixture('test.json');
      const largeJson = JSON.parse(largeJsonStr);
      const scope = nock('https://example.com')
        .get('/large-json')
        .reply(200, largeJson);
      const resp = await httpsq.httpsQuery(
        'https://example.com/large-json',
        {}
      );
      expect(resp.statusCode).toBe(200);
      expect(resp.data).toBe(largeJsonStr);
      expect(resp.json).toStrictEqual(largeJson);
      expect(scope.isDone()).toBe(true);
    });
    it('handles non-200 responses as resolution', async () => {
      const scope = nock('https://example.com')
        .get('/not-found')
        .reply(404, '404 - not found');
      const resp = await httpsq.httpsQuery('https://example.com/not-found', {});
      expect(resp.statusCode).toBe(404);
      expect(resp.data).toBe('404 - not found');
      expect(resp.json).toBeNull();
      expect(scope.isDone()).toBe(true);
    });
    it('translates request errors into rejects', async () => {
      const scope = nock('https://example.com')
        .get('/err')
        .replyWithError('error in request');
      const resp = httpsq.httpsQuery('https://example.com/err', {});
      await expect(resp).rejects.toStrictEqual(new Error('error in request'));
      expect(scope.isDone()).toBe(true);
    });
  });
});
