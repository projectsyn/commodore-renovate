import { OutgoingHttpHeaders } from 'http';
import https from 'https';

export type Response = {
  data: string;
  json: null | object;
  statusCode: number;
};

export async function httpsQuery(
  url: string,
  headers: OutgoingHttpHeaders
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      headers: headers,
    };
    https
      .get(url, options, function (response) {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (data: string) => {
          body += data;
        });
        response.on('error', reject);
        response.on('end', () => {
          const json = response.headers['content-type']?.includes(
            'application/json'
          )
            ? JSON.parse(body)
            : null;
          resolve({
            data: body,
            json: json,
            statusCode: response.statusCode,
          } as Response);
        });
      })
      .on('error', reject);
  });
}
