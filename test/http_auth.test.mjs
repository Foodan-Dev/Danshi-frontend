import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

import { AppError } from '../src/lib/errors/app_error.ts';

const TEST_STATE_KEY = Symbol.for('danshi.http-auth-test');
const moduleSources = new Map([
  ['http-auth-test:client', `
    const getState = () => globalThis[Symbol.for('danshi.http-auth-test')];

    export function createHttpClient(options = {}) {
      if (options.getAuthToken) {
        return {
          request: async (...args) => {
            const state = getState();
            const token = await options.getAuthToken();
            state.seenTokens.push(token);
            return state.baseRequest(...args);
          },
        };
      }

      return {
        post: (...args) => getState().refreshRequest(...args),
      };
    }
  `],
  ['http-auth-test:auth-storage', `
    const getStorage = () => globalThis[Symbol.for('danshi.http-auth-test')].storage;

    export const AuthStorage = {
      getToken: (...args) => getStorage().getToken(...args),
      setToken: (...args) => getStorage().setToken(...args),
      clearToken: (...args) => getStorage().clearToken(...args),
      getRefreshToken: (...args) => getStorage().getRefreshToken(...args),
      setRefreshToken: (...args) => getStorage().setRefreshToken(...args),
      clearRefreshToken: (...args) => getStorage().clearRefreshToken(...args),
    };
  `],
  ['http-auth-test:constants', `
    export const API_ENDPOINTS = { AUTH: { REFRESH: '/auth/refresh' } };
  `],
  ['http-auth-test:response', `
    export const unwrapApiResponse = (payload) => payload.data;
  `],
]);

const mockedModules = new Map([
  ['@/src/lib/http/client', 'http-auth-test:client'],
  ['@/src/lib/auth/auth_storage', 'http-auth-test:auth-storage'],
  ['@/src/constants/app', 'http-auth-test:constants'],
  ['@/src/lib/http/response', 'http-auth-test:response'],
]);

registerHooks({
  resolve(specifier, context, nextResolve) {
    const mockedUrl = mockedModules.get(specifier);
    if (mockedUrl) return { url: mockedUrl, shortCircuit: true };

    if (specifier.startsWith('@/')) {
      const relativePath = `../${specifier.slice(2)}.ts`;
      return { url: new URL(relativePath, import.meta.url).href, shortCircuit: true };
    }

    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    const source = moduleSources.get(url);
    if (source) return { format: 'module', source, shortCircuit: true };
    return nextLoad(url, context);
  },
});

globalThis.__DEV__ = false;

const { httpAuth } = await import('../src/lib/http/http_auth.ts');

const unauthorized = () => AppError.fromApiResponse({
  code: 401,
  message: '未登录',
  data: null,
  error_code: 'unauthorized',
}, 401);

const sessionRevoked = () => AppError.fromApiResponse({
  code: 401,
  message: '会话已撤销',
  data: null,
  error_code: 'session_revoked',
}, 401);

const resetState = () => {
  const credentials = {
    token: 'old-access-token',
    refreshToken: 'valid-refresh-token',
  };
  const calls = {
    clearToken: 0,
    clearRefreshToken: 0,
    refresh: 0,
  };

  const state = {
    calls,
    credentials,
    seenTokens: [],
    baseRequest: async () => {
      throw unauthorized();
    },
    refreshRequest: async () => {
      calls.refresh += 1;
      throw new Error('未设置刷新响应');
    },
    storage: {
      getToken: async () => credentials.token,
      setToken: async (token) => {
        credentials.token = token;
      },
      clearToken: async () => {
        calls.clearToken += 1;
        credentials.token = undefined;
      },
      getRefreshToken: async () => credentials.refreshToken,
      setRefreshToken: async (token) => {
        credentials.refreshToken = token;
      },
      clearRefreshToken: async () => {
        calls.clearRefreshToken += 1;
        credentials.refreshToken = undefined;
      },
    },
  };

  globalThis[TEST_STATE_KEY] = state;
  return state;
};

const assertCredentialsPreserved = (state) => {
  assert.equal(state.calls.clearToken, 0);
  assert.equal(state.calls.clearRefreshToken, 0);
  assert.equal(state.credentials.token, 'old-access-token');
  assert.equal(state.credentials.refreshToken, 'valid-refresh-token');
};

test('刷新遇到网络错误或超时时保留凭据并抛出原始错误', async (t) => {
  const errors = [
    new AppError('网络不可达', {
      clientCode: 'NETWORK_ERROR',
      cause: new TypeError('fetch failed'),
    }),
    new AppError('请求超时', { clientCode: 'TIMEOUT' }),
  ];

  for (const refreshError of errors) {
    await t.test(refreshError.message, async () => {
      const state = resetState();
      state.refreshRequest = async () => {
        state.calls.refresh += 1;
        throw refreshError;
      };

      await assert.rejects(httpAuth.get('/protected'), (error) => {
        assert.strictEqual(error, refreshError);
        assert.notEqual(error.clientCode, 'AUTH_EXPIRED');
        return true;
      });

      assertCredentialsPreserved(state);
      assert.equal(state.calls.refresh, 1);
    });
  }
});

test('刷新收到无法归类的 401 时保留凭据并抛出原始错误', async () => {
  const state = resetState();
  const refreshError = AppError.fromApiResponse({
    code: 401,
    message: '凭据错误',
    data: null,
    error_code: 'credentials_invalid',
  }, 401);
  state.refreshRequest = async () => {
    state.calls.refresh += 1;
    throw refreshError;
  };

  await assert.rejects(httpAuth.get('/protected'), (error) => {
    assert.strictEqual(error, refreshError);
    assert.notEqual(error.clientCode, 'AUTH_EXPIRED');
    return true;
  });

  assertCredentialsPreserved(state);
});

test('刷新遇到 502 或 503 时保留凭据并抛出原始错误', async (t) => {
  for (const status of [502, 503]) {
    await t.test(String(status), async () => {
      const state = resetState();
      const refreshError = AppError.fromApiResponse(null, status);
      state.refreshRequest = async () => {
        state.calls.refresh += 1;
        throw refreshError;
      };

      await assert.rejects(httpAuth.get('/protected'), (error) => {
        assert.strictEqual(error, refreshError);
        assert.notEqual(error.clientCode, 'AUTH_EXPIRED');
        return true;
      });

      assertCredentialsPreserved(state);
      assert.equal(state.calls.refresh, 1);
    });
  }
});

test('刷新收到 401 unauthorized 时清除凭据并抛出 AUTH_EXPIRED', async () => {
  const state = resetState();
  state.refreshRequest = async () => {
    state.calls.refresh += 1;
    throw unauthorized();
  };

  await assert.rejects(httpAuth.get('/protected'), (error) => {
    assert.equal(error.clientCode, 'AUTH_EXPIRED');
    assert.equal(error.errorCode, 'unauthorized');
    assert.equal(error.status, 401);
    return true;
  });

  assert.equal(state.calls.clearToken, 1);
  assert.equal(state.calls.clearRefreshToken, 1);
  assert.equal(state.credentials.token, undefined);
  assert.equal(state.credentials.refreshToken, undefined);
});

test('本地没有 refresh token 时清除凭据并抛出 AUTH_EXPIRED', async () => {
  const state = resetState();
  state.credentials.refreshToken = undefined;

  await assert.rejects(httpAuth.get('/protected'), (error) => {
    assert.equal(error.clientCode, 'AUTH_EXPIRED');
    assert.equal(error.errorCode, 'unauthorized');
    assert.equal(error.status, 401);
    return true;
  });

  assert.equal(state.calls.refresh, 0);
  assert.equal(state.calls.clearToken, 1);
  assert.equal(state.calls.clearRefreshToken, 1);
});

test('原请求收到 session_revoked 时直接清除凭据且不尝试刷新', async () => {
  const state = resetState();
  state.baseRequest = async () => {
    throw sessionRevoked();
  };

  await assert.rejects(httpAuth.get('/protected'), (error) => {
    assert.equal(error.clientCode, 'AUTH_EXPIRED');
    assert.equal(error.errorCode, 'session_revoked');
    assert.equal(error.status, 401);
    return true;
  });

  assert.equal(state.calls.refresh, 0);
  assert.equal(state.calls.clearToken, 1);
  assert.equal(state.calls.clearRefreshToken, 1);
});

test('刷新成功后使用新 token 重试原请求并返回结果', async () => {
  const state = resetState();
  const expected = { ok: true };
  state.baseRequest = async () => {
    if (state.credentials.token === 'old-access-token') throw unauthorized();
    return expected;
  };
  state.refreshRequest = async (path, body) => {
    state.calls.refresh += 1;
    assert.equal(path, '/auth/refresh');
    assert.deepEqual(body, { refresh_token: 'valid-refresh-token' });
    return {
      code: 200,
      message: 'ok',
      data: {
        token: 'new-access-token',
        refresh_token: 'new-refresh-token',
      },
    };
  };

  const result = await httpAuth.get('/protected');

  assert.strictEqual(result, expected);
  assert.deepEqual(state.seenTokens, ['old-access-token', 'new-access-token']);
  assert.equal(state.credentials.token, 'new-access-token');
  assert.equal(state.credentials.refreshToken, 'new-refresh-token');
  assert.equal(state.calls.refresh, 1);
  assert.equal(state.calls.clearToken, 0);
  assert.equal(state.calls.clearRefreshToken, 0);
});

test('并发的未授权请求只触发一次刷新', async () => {
  const state = resetState();
  let releaseRefresh;
  const refreshGate = new Promise((resolve) => {
    releaseRefresh = resolve;
  });
  let markRefreshStarted;
  const refreshStarted = new Promise((resolve) => {
    markRefreshStarted = resolve;
  });

  state.baseRequest = async () => {
    if (state.credentials.token === 'old-access-token') throw unauthorized();
    return { ok: true };
  };
  state.refreshRequest = async () => {
    state.calls.refresh += 1;
    markRefreshStarted();
    await refreshGate;
    return {
      code: 200,
      message: 'ok',
      data: { token: 'new-access-token' },
    };
  };

  const requests = [httpAuth.get('/first'), httpAuth.get('/second')];
  await refreshStarted;
  releaseRefresh();
  const results = await Promise.all(requests);

  assert.deepEqual(results, [{ ok: true }, { ok: true }]);
  assert.equal(state.calls.refresh, 1);
});
