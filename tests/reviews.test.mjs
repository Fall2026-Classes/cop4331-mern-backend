
import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const app = require('../server');
const { User, Review } = require('../models');

let mongoServer;
let tokenA;
let tokenB;
let userA;

async function register(login) {
  await User.create({ login, password: 'Password123!' });
  const res = await request(app)
    .post('/api/auth/login')
    .send({ login, password: 'Password123!' });
  return res.body;
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

const validReview = {
  movieTitle: 'Interstellar',
  rating: 4.5,
  description: 'An incredible science fiction movie.'
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  await User.init();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Review.deleteMany({});
  await User.deleteMany({});

  const a = await register('alice');
  const b = await register('bob');

  userA = a;
  tokenA = a.token;
  tokenB = b.token;
});

describe('login token', () => {
  test('login returns a token alongside the user record', async () => {
    expect(typeof tokenA).toBe('string');
    expect(userA.login).toBe('alice');
    expect(userA.password).toBeUndefined();
  });
});

describe('authentication', () => {
  test('rejects requests without a token', async () => {
    const res = await request(app).get('/api/reviews');
    expect(res.status).toBe(401);
  });

  test('rejects an invalid token', async () => {
    const res = await request(app).get('/api/reviews').set(auth('not-a-real-token'));
    expect(res.status).toBe(401);
  });
});

describe('POST /api/reviews', () => {
  test('creates a review owned by the signed-in user', async () => {
    const res = await request(app).post('/api/reviews').set(auth(tokenA)).send(validReview);

    expect(res.status).toBe(201);
    expect(res.body.movieTitle).toBe('Interstellar');
    expect(res.body.userId).toBe(userA._id);
  });

  test('ignores a userId sent by the client', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set(auth(tokenA))
      .send({ ...validReview, userId: new mongoose.Types.ObjectId().toString() });

    expect(res.status).toBe(201);
    expect(res.body.userId).toBe(userA._id);
  });

  test('rejects an invalid rating with 400', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set(auth(tokenA))
      .send({ ...validReview, rating: 7 });

    expect(res.status).toBe(400);
  });

  test('rejects a missing title with 400', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set(auth(tokenA))
      .send({ rating: 3, description: 'No title' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/reviews', () => {
  test('returns only the signed-in user\'s reviews, newest first', async () => {
    await request(app).post('/api/reviews').set(auth(tokenA)).send({ ...validReview, movieTitle: 'First' });
    await request(app).post('/api/reviews').set(auth(tokenA)).send({ ...validReview, movieTitle: 'Second' });
    await request(app).post('/api/reviews').set(auth(tokenB)).send({ ...validReview, movieTitle: 'Bobs' });

    const res = await request(app).get('/api/reviews').set(auth(tokenA));

    expect(res.status).toBe(200);
    expect(res.body.map((r) => r.movieTitle)).toEqual(['Second', 'First']);
  });
});

describe('GET /api/reviews/:id', () => {
  test('returns an owned review', async () => {
    const created = await request(app).post('/api/reviews').set(auth(tokenA)).send(validReview);
    const res = await request(app).get(`/api/reviews/${created.body._id}`).set(auth(tokenA));

    expect(res.status).toBe(200);
    expect(res.body._id).toBe(created.body._id);
  });

  test('returns 404 for another user\'s review', async () => {
    const created = await request(app).post('/api/reviews').set(auth(tokenA)).send(validReview);
    const res = await request(app).get(`/api/reviews/${created.body._id}`).set(auth(tokenB));

    expect(res.status).toBe(404);
  });

  test('returns 404 for a malformed id', async () => {
    const res = await request(app).get('/api/reviews/nope').set(auth(tokenA));
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/reviews/:id', () => {
  test('updates allowed fields', async () => {
    const created = await request(app).post('/api/reviews').set(auth(tokenA)).send(validReview);
    const res = await request(app)
      .patch(`/api/reviews/${created.body._id}`)
      .set(auth(tokenA))
      .send({ rating: 3, description: 'Changed my mind.' });

    expect(res.status).toBe(200);
    expect(res.body.rating).toBe(3);
    expect(res.body.description).toBe('Changed my mind.');
    expect(res.body.movieTitle).toBe('Interstellar');
  });

  test('does not allow changing the owner', async () => {
    const created = await request(app).post('/api/reviews').set(auth(tokenA)).send(validReview);
    const res = await request(app)
      .patch(`/api/reviews/${created.body._id}`)
      .set(auth(tokenA))
      .send({ rating: 2, userId: new mongoose.Types.ObjectId().toString() });

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(userA._id);
  });

  test('returns 404 when another user tries to edit', async () => {
    const created = await request(app).post('/api/reviews').set(auth(tokenA)).send(validReview);
    const res = await request(app)
      .patch(`/api/reviews/${created.body._id}`)
      .set(auth(tokenB))
      .send({ rating: 1 });

    expect(res.status).toBe(404);
  });

  test('rejects an invalid rating with 400', async () => {
    const created = await request(app).post('/api/reviews').set(auth(tokenA)).send(validReview);
    const res = await request(app)
      .patch(`/api/reviews/${created.body._id}`)
      .set(auth(tokenA))
      .send({ rating: 9 });

    expect(res.status).toBe(400);
  });

  test('rejects an empty update with 400', async () => {
    const created = await request(app).post('/api/reviews').set(auth(tokenA)).send(validReview);
    const res = await request(app)
      .patch(`/api/reviews/${created.body._id}`)
      .set(auth(tokenA))
      .send({ userId: 'x' });

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/reviews/:id', () => {
  test('deletes an owned review', async () => {
    const created = await request(app).post('/api/reviews').set(auth(tokenA)).send(validReview);
    const res = await request(app).delete(`/api/reviews/${created.body._id}`).set(auth(tokenA));

    expect(res.status).toBe(200);
    expect(await Review.countDocuments()).toBe(0);
  });

  test('returns 404 and keeps the review when another user tries to delete', async () => {
    const created = await request(app).post('/api/reviews').set(auth(tokenA)).send(validReview);
    const res = await request(app).delete(`/api/reviews/${created.body._id}`).set(auth(tokenB));

    expect(res.status).toBe(404);
    expect(await Review.countDocuments()).toBe(1);
  });
});

describe('diary fields', () => {
  test('defaults type to movie and stores optional year and watched date', async () => {
    const plain = await request(app).post('/api/reviews').set(auth(tokenA)).send(validReview);
    expect(plain.body.type).toBe('movie');

    const full = await request(app)
      .post('/api/reviews')
      .set(auth(tokenA))
      .send({ ...validReview, type: 'show', year: 2008, watchedOn: '2026-11-01' });

    expect(full.status).toBe(201);
    expect(full.body.type).toBe('show');
    expect(full.body.year).toBe(2008);
    expect(full.body.watchedOn).toContain('2026-11-01');
  });

  test('accepts rating 0 for an unrated entry and clears year with null', async () => {
    const created = await request(app)
      .post('/api/reviews')
      .set(auth(tokenA))
      .send({ ...validReview, rating: 0, year: 2010 });
    expect(created.status).toBe(201);

    const res = await request(app)
      .patch(`/api/reviews/${created.body._id}`)
      .set(auth(tokenA))
      .send({ year: null });
    expect(res.status).toBe(200);
    expect(res.body.year == null).toBe(true);
  });

  test('rejects an unknown type with 400', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set(auth(tokenA))
      .send({ ...validReview, type: 'podcast' });
    expect(res.status).toBe(400);
  });
});

describe('user names', () => {
  test('registration stores optional names and login returns them', async () => {
    const reg = await request(app)
      .post('/api/users')
      .send({ login: 'carol', password: 'Password123!', firstName: 'Carol', lastName: 'Danvers' });
    expect(reg.status).toBe(201);
    expect(reg.body.user.firstName).toBe('Carol');

    const res = await request(app)
      .post('/api/auth/login')
      .send({ login: 'carol', password: 'Password123!' });
    expect(res.body.firstName).toBe('Carol');
    expect(res.body.lastName).toBe('Danvers');
    expect(typeof res.body.token).toBe('string');
  });
});
