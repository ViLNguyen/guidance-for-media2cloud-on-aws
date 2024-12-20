// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

let https = require('node:https');
const Environment = require('./environment');
const {
  M2CException,
} = require('./error');

if (process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined) {
  try {
    const {
      captureHTTPs,
    } = require('aws-xray-sdk-core');
    https = captureHTTPs(require('node:https'));
  } catch (e) {
    console.log('aws-xray-sdk-core not loaded');
  }
}

/**
 * @class Metrics
 * @description send anonymous data to help us to improve the solution
 */
class Metrics {
  static get Constants() {
    return {
      Host: 'metrics.awssolutionsbuilder.com',
      Path: '/generic',
    };
  }

  /**
   * @static
   * @function sendAnonymousData
   * @description send anonymous data to aws solution builder team to help us improve the solution.
   * @param {*} data - JSON data to send anonymously
   * @param {*} env - overwrite payload parameters, used for custom-resource lambda.
   */
  static async sendAnonymousData(data, env) {
    return new Promise((resolve, reject) => {
      const payload = Object.assign({
        Solution: Environment.Solution.Id,
        UUID: Environment.Solution.Metrics.Uuid,
        TimeStamp: (new Date()).toISOString().replace('T', ' ').replace('Z', ''),
        Data: data,
      }, env);

      if (!payload.Data || !payload.Solution || !payload.UUID) {
        resolve(undefined);
      }

      const buffers = [];

      const params = {
        hostname: Metrics.Constants.Host,
        port: 443,
        path: Metrics.Constants.Path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const request = https.request(params, (response) => {
        response.on('data', chunk =>
          buffers.push(chunk));

        response.on('end', () => {
          if (response.statusCode >= 400) {
            reject(new M2CException(`${response.statusCode} ${response.statusMessage} ${params.hostname}`));
            return;
          }
          resolve(Buffer.concat(buffers));
        });
      });

      request.write(JSON.stringify(payload));

      request.on('error', e =>
        reject(e));

      request.end();
    });
  }
}

module.exports = Metrics;
