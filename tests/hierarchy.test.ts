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

describe('GET /api/hierarchy/:type', () => {
  it('should return 401 when API key is missing', async () => {
    const res = await request(app).get('/api/hierarchy/group');
    expect(res.status).toBe(401);
  });

  it('should return 400 for invalid type', async () => {
    const res = await request(app)
      .get('/api/hierarchy/invalid_type')
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
  });

  it('should return nodes by type', async () => {
    await HierarchyNode.create({
      id: 'SP_TYPE_TEST',
      type: 'strategic_pillar',
      name: 'Test Pillar',
      leader_email: 'leader@company.com',
      parent_id: null,
      members: [],
    });

    const res = await request(app)
      .get('/api/hierarchy/strategic_pillar')
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].name).toBe('Test Pillar');
  });

  it('should return empty array when no nodes of type exist', async () => {
    const res = await request(app)
      .get('/api/hierarchy/team')
      .set('x-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('POST /api/hierarchy', () => {
  it('should return 401 when API key is missing', async () => {
    const res = await request(app)
      .post('/api/hierarchy')
      .send({ type: 'group', name: 'Test', leader_email: 'l@c.com' });
    expect(res.status).toBe(401);
  });

  it('should return 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/hierarchy')
      .set('x-api-key', API_KEY)
      .send({ name: 'Test Group' });
    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid type', async () => {
    const res = await request(app)
      .post('/api/hierarchy')
      .set('x-api-key', API_KEY)
      .send({ type: 'invalid', name: 'Test', leader_email: 'l@c.com' });
    expect(res.status).toBe(400);
  });

  it('should return 404 when parent_id does not exist', async () => {
    const res = await request(app)
      .post('/api/hierarchy')
      .set('x-api-key', API_KEY)
      .send({
        type: 'team',
        name: 'Test Team',
        leader_email: 'leader@company.com',
        parent_id: 'nonexistent-id',
      });
    expect(res.status).toBe(404);
  });

  it('should create a node successfully', async () => {
    const res = await request(app)
      .post('/api/hierarchy')
      .set('x-api-key', API_KEY)
      .send({
        type: 'strategic_pillar',
        name: 'New Pillar',
        leader_email: 'pillar@company.com',
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('New Pillar');
    expect(res.body.type).toBe('strategic_pillar');
    expect(res.body.id).toBeDefined();
  });

  it('should create a child node with valid parent_id', async () => {
    await HierarchyNode.create({
      id: 'PARENT_SP',
      type: 'strategic_pillar',
      name: 'Parent Pillar',
      leader_email: 'parent@company.com',
      parent_id: null,
      members: [],
    });

    const res = await request(app)
      .post('/api/hierarchy')
      .set('x-api-key', API_KEY)
      .send({
        type: 'business_unit',
        name: 'Child BU',
        leader_email: 'child@company.com',
        parent_id: 'PARENT_SP',
      });

    expect(res.status).toBe(201);
    expect(res.body.parent_id).toBe('PARENT_SP');
  });
});

describe('PUT /api/hierarchy/:nodeId/leader', () => {
  it('should return 401 when API key is missing', async () => {
    const res = await request(app)
      .put('/api/hierarchy/some-id/leader')
      .send({ leader_email: 'new@company.com' });
    expect(res.status).toBe(401);
  });

  it('should return 400 when leader_email is missing', async () => {
    const res = await request(app)
      .put('/api/hierarchy/some-id/leader')
      .set('x-api-key', API_KEY)
      .send({});
    expect(res.status).toBe(400);
  });

  it('should return 404 when node not found', async () => {
    const res = await request(app)
      .put('/api/hierarchy/nonexistent-id/leader')
      .set('x-api-key', API_KEY)
      .send({ leader_email: 'new@company.com' });
    expect(res.status).toBe(404);
  });

  it('should update leader successfully', async () => {
    await HierarchyNode.create({
      id: 'NODE_UPDATE',
      type: 'group',
      name: 'Test Group',
      leader_email: 'old@company.com',
      parent_id: null,
      members: [],
    });

    const res = await request(app)
      .put('/api/hierarchy/NODE_UPDATE/leader')
      .set('x-api-key', API_KEY)
      .send({ leader_email: 'new@company.com' });

    expect(res.status).toBe(200);
    expect(res.body.leader_email).toBe('new@company.com');
  });
});
