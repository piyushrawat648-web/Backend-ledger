const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const authMiddleware = require('../src/middleware/auth.middleware');
const userModel = require('../src/models/user.model');
const tokenBlackListModel = require('../src/models/blackList.model');

function createRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

test('allows a configured system user email', async () => {
  process.env.SYSTEM_USER_EMAIL = 'system@example.com';
  process.env.JWT_SECRET = 'test-secret';
  jwt.verify = () => ({ userId: 'user-1' });
  tokenBlackListModel.findOne = async () => null;
  userModel.findById = () => ({
    select() {
      return {
        _id: 'user-1',
        email: 'system@example.com',
        systemUser: false
      };
    }
  });

  const req = { headers: { authorization: 'Bearer test-token' }, cookies: {} };
  const res = createRes();
  let nextCalled = false;

  await authMiddleware.authSystemUserMiddleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
});

test('blocks a regular user when no system-user access is configured', async () => {
  delete process.env.SYSTEM_USER_EMAIL;
  process.env.JWT_SECRET = 'test-secret';
  jwt.verify = () => ({ userId: 'user-2' });
  tokenBlackListModel.findOne = async () => null;
  userModel.findById = () => ({
    select() {
      return {
        _id: 'user-2',
        email: 'user@example.com',
        systemUser: false
      };
    }
  });

  const req = { headers: { authorization: 'Bearer test-token' }, cookies: {} };
  const res = createRes();
  let nextCalled = false;

  await authMiddleware.authSystemUserMiddleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.message, 'Forbidden access, not a system user');
});
