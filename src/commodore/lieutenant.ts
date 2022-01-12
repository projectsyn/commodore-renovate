import normalizeUrl from 'normalize-url';

import type { ClusterInfo } from './types';
import { httpsQuery } from './https-query';
import type { Response } from './https-query';

type LieutenantErrorReply = {
  reason: string;
};

export class LieutenantError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    Object.setPrototypeOf(this, LieutenantError.prototype);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
  }
}

export async function fetchClusterInfo(
  config: any,
  clusterId: string
): Promise<ClusterInfo> {
  const headers = {
    Authorization: `Bearer ${config.lieutenantToken}`,
  };
  const url = normalizeUrl(`${config.lieutenantURL}/clusters/${clusterId}`);
  return new Promise((resolve, reject) => {
    let res = httpsQuery(url, headers);
    res
      .then((resp: Response) => {
        if (resp.statusCode != 200) {
          if (resp.json != null) {
            const error: LieutenantErrorReply =
              resp.json as LieutenantErrorReply;
            reject(new LieutenantError(error.reason, resp.statusCode));
          } else {
            reject(new LieutenantError('Query error', resp.statusCode));
          }
        } else {
          resolve(resp.json as ClusterInfo);
        }
      })
      .catch(reject);
  });
}
