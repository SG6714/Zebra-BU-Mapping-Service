import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { HierarchyNode } from '../src/models/HierarchyNode';

// Mock graphService
jest.mock('../src/services/graphService', () => ({
  getManagerChain: jest.fn().mockResolvedValue([]),
}));

const API_KEY = 'test-api-key';

beforeAll(async () => {
  await connectDatabase(process.env.MONGODB_URI!);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await disconnectDatabase();
});

beforeEach(async () => {
  await HierarchyNode.deleteMany({});
});

describe('GET /api/users/:email/hierarchy', () => {
  it('should return 401 when API key is missing', async () => {
    const res = await request(app).get('/api/users/test@example.com/hierarchy');
    expect(res.status).toBe(401);
  });

  it('should return 404 when user not found', async () => {
    const res = await request(app)
      .get('/api/users/notfound@example.com/hierarchy')
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(404);
  });

  it('should return hierarchy for a member', async () => {
    await HierarchyNode.create({
      id: 'SP001',
      type: 'strategic_pillar',
      name: 'Connected Frontline Workers',
      leader_email: 'alice@company.com',
      parent_id: null,
      members: [],
    });

    await HierarchyNode.create({
      id: 'BU101',
      type: 'business_unit',
      name: 'Workcloud Software',
      leader_email: 'bob@company.com',
      parent_id: 'SP001',
      members: [],
    });

    await HierarchyNode.create({
      id: 'TM001',
      type: 'team',
      name: 'AI Solutions',
      leader_email: 'carol@company.com',
      parent_id: 'BU101',
      members: [],
    });

    await HierarchyNode.create({
      id: 'GR001',
      type: 'group',
      name: 'Solutions Strategy',
      leader_email: 'dan@company.com',
      parent_id: 'TM001',
      members: [{ email: 'eva@company.com' }],
    });

    const res = await request(app)
      .get('/api/users/eva@company.com/hierarchy')
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.member_email).toBe('eva@company.com');
    expect(res.body.group).toBeDefined();
    expect(res.body.group.name).toBe('Solutions Strategy');
    expect(res.body.team).toBeDefined();
    expect(res.body.team.name).toBe('AI Solutions');
    expect(res.body.business_unit).toBeDefined();
    expect(res.body.business_unit.name).toBe('Workcloud Software');
    expect(res.body.strategic_pillar).toBeDefined();
    expect(res.body.strategic_pillar.name).toBe('Connected Frontline Workers');
  });

  it('should return hierarchy for a leader', async () => {
    await HierarchyNode.create({
      id: 'SP002',
      type: 'strategic_pillar',
      name: 'Test Pillar',
      leader_email: 'leader@company.com',
      parent_id: null,
      members: [],
    });

    const res = await request(app)
      .get('/api/users/leader@company.com/hierarchy')
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.member_email).toBe('leader@company.com');
    expect(res.body.strategic_pillar).toBeDefined();
  });
});

describe('POST /api/users/hierarchy/search', () => {
  it('should return 401 when API key is missing', async () => {
    const res = await request(app)
      .post('/api/users/hierarchy/search')
      .send({ emails: ['test@example.com'] });
    expect(res.status).toBe(401);
  });

  it('should return 400 when emails array is missing', async () => {
    const res = await request(app)
      .post('/api/users/hierarchy/search')
      .set('x-api-key', API_KEY)
      .send({});
    expect(res.status).toBe(400);
  });

  it('should return 400 when emails array is empty', async () => {
    const res = await request(app)
      .post('/api/users/hierarchy/search')
      .set('x-api-key', API_KEY)
      .send({ emails: [] });
    expect(res.status).toBe(400);
  });

  it('should return 400 when more than 100 emails', async () => {
    const emails = Array.from({ length: 101 }, (_, i) => `user${i}@example.com`);
    const res = await request(app)
      .post('/api/users/hierarchy/search')
      .set('x-api-key', API_KEY)
      .send({ emails });
    expect(res.status).toBe(400);
  });

  it('should return bulk hierarchy results', async () => {
    await HierarchyNode.create({
      id: 'GR_BULK',
      type: 'group',
      name: 'Bulk Group',
      leader_email: 'leader@company.com',
      parent_id: null,
      members: [{ email: 'user1@company.com' }, { email: 'user2@company.com' }],
    });

    const res = await request(app)
      .post('/api/users/hierarchy/search')
      .set('x-api-key', API_KEY)
      .send({ emails: ['user1@company.com', 'user2@company.com', 'notfound@company.com'] });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(3);
    expect(res.body[0].member_email).toBe('user1@company.com');
    expect(res.body[1].member_email).toBe('user2@company.com');
    expect(res.body[2]).toBeNull();
  });
});
