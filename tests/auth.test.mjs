
import { describe, test, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const app = require('../server');
const { User } = require('../models');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();

  await mongoose.connect(mongoServer.getUri());

  // Ensure the unique username index exists.
  await User.init();
});

afterEach(async () => {
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});


describe('POST /api/users', () => {

  test('registers a user and returns 201', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ login: 'john', password: 'Password123!' });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('User registered successfully');
    expect(res.body.user.login).toBe('john');
    expect(res.body.user.password).toBeUndefined();
  });

  test('ignores a role sent by the client', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ login: 'john', password: 'Password123!', role: 'admin' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('user');
  });

  test('rejects a duplicate login with 409', async () => {
    await User.create({ login: 'john', password: 'Password123!' });

    const res = await request(app)
      .post('/api/users')
      .send({ login: 'john', password: 'Another123!' });

    expect(res.status).toBe(409);
  });

  test('rejects missing fields with 400', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ login: 'john' });

    expect(res.status).toBe(400);
  });

  test('rejects a too-short login with 400', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ login: 'ab', password: 'Password123!' });

    expect(res.status).toBe(400);
  });
});


describe('POST /api/auth/login', () => {

  test('returns the user record and 200 for correct credentials', async () => {
    await User.create({ login: 'john', password: 'Password123!' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ login: 'john', password: 'Password123!' });

    expect(res.status).toBe(200);
    expect(res.body.login).toBe('john');
    expect(res.body._id).toBeDefined();
    expect(res.body.password).toBeUndefined();
  });

  test('returns 401 for a wrong password', async () => {
    await User.create({ login: 'john', password: 'Password123!' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ login: 'john', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid login or password');
  });

  test('returns 401 for an unknown login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ login: 'nobody', password: 'Password123!' });

    expect(res.status).toBe(401);
  });
});
