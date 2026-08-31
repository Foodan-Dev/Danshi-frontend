import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { AppError } from '../src/lib/errors/app_error.ts';

const openapi = JSON.parse(readFileSync(new URL('../openapi.json', import.meta.url), 'utf8'));

test('preserves every backend business error code declared by OpenAPI', () => {
  for (const errorCode of openapi.components.schemas.BizCode.enum) {
    const error = AppError.fromApiResponse({
      code: 409,
      message: '标签操作失败',
      data: null,
      error_code: errorCode,
    }, 409);

    assert.equal(error.errorCode, errorCode, `did not preserve ${errorCode}`);
    assert.equal(error.clientCode, undefined);
  }
});

test('preserves every backend field error code declared by OpenAPI', () => {
  const fieldCodes = openapi.components.schemas.FieldCode.enum;
  const error = AppError.fromApiResponse({
    code: 422,
    message: '字段不合法',
    data: {
      errors: fieldCodes.map((code) => ({ field: 'value', code, message: code })),
    },
    error_code: 'validation_failed',
  }, 422);

  assert.deepEqual(error.fieldErrors?.map(({ code }) => code), fieldCodes);
});

test('preserves the backend error id for internal errors', () => {
  const error = AppError.fromApiResponse({
    code: 500,
    message: '服务器内部错误',
    data: { error_id: '0123456789abcdef' },
    error_code: 'internal_error',
  }, 500);

  assert.equal(error.errorId, '0123456789abcdef');
});

test('keeps client errors separate from backend business errors', () => {
  const error = new AppError('请求超时', { clientCode: 'TIMEOUT' });

  assert.equal(error.clientCode, 'TIMEOUT');
  assert.equal(error.errorCode, undefined);
});
