import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryRepository } from './repository.js';
import { deriveTargetKey } from '@pagepulse/core';

describe('Repository & Tenant Isolation', () => {
  let repo: MemoryRepository;

  beforeEach(() => {
    repo = new MemoryRepository();
  });

  it('enforces strict tenant isolation on watch access', async () => {
    const userA = await repo.createUser({ email: 'userA@example.com', displayName: 'User A' });
    const userB = await repo.createUser({ email: 'userB@example.com', displayName: 'User B' });

    const target = await repo.findOrCreateTarget(
      'https://example.com',
      deriveTargetKey('https://example.com'),
      'example.com'
    );

    const watchA = await repo.createWatch({
      userId: userA.id,
      targetId: target.id,
      name: "User A's Watch",
      intervalMinutes: 60,
      enabled: true,
      sensitivity: 'normal',
      includeSelectors: [],
      ignoreSelectors: [],
      normalizationRules: {},
      status: 'OK',
      nextCheckAt: new Date(),
    });

    // User A can access their own watch
    const retrievedA = await repo.getWatchById(watchA.id, userA.id);
    expect(retrievedA).not.toBeNull();
    expect(retrievedA?.name).toBe("User A's Watch");

    // User B CANNOT access User A's watch
    const retrievedB = await repo.getWatchById(watchA.id, userB.id);
    expect(retrievedB).toBeNull();

    // User B CANNOT update or delete User A's watch
    const updatedByB = await repo.updateWatch(watchA.id, userB.id, { name: 'Hacked' });
    expect(updatedByB).toBeNull();

    const deletedByB = await repo.deleteWatch(watchA.id, userB.id);
    expect(deletedByB).toBe(false);

    // Watch remains intact for User A
    expect(await repo.getWatchById(watchA.id, userA.id)).not.toBeNull();
  });

  it('shares targets between multiple users watching the same URL', async () => {
    const user1 = await repo.createUser({ email: 'u1@example.com', displayName: 'User 1' });
    const user2 = await repo.createUser({ email: 'u2@example.com', displayName: 'User 2' });

    const canonicalUrl = 'https://news.ycombinator.com';
    const targetKey = deriveTargetKey(canonicalUrl);

    const target1 = await repo.findOrCreateTarget(canonicalUrl, targetKey, 'news.ycombinator.com');
    const target2 = await repo.findOrCreateTarget(canonicalUrl, targetKey, 'news.ycombinator.com');

    // Both point to the exact same shared target entity
    expect(target1.id).toBe(target2.id);

    await repo.createWatch({
      userId: user1.id,
      targetId: target1.id,
      name: 'HN User 1',
      intervalMinutes: 15,
      enabled: true,
      sensitivity: 'high',
      includeSelectors: [],
      ignoreSelectors: [],
      normalizationRules: {},
      status: 'OK',
      nextCheckAt: new Date(),
    });

    await repo.createWatch({
      userId: user2.id,
      targetId: target2.id,
      name: 'HN User 2',
      intervalMinutes: 30,
      enabled: true,
      sensitivity: 'normal',
      includeSelectors: ['.title'],
      ignoreSelectors: [],
      normalizationRules: {},
      status: 'OK',
      nextCheckAt: new Date(),
    });

    const targetWatches = await repo.listWatchesForTarget(target1.id);
    expect(targetWatches).toHaveLength(2);
  });

  it('findDueWatches correctly identifies watches scheduled before or at now', async () => {
    const user = await repo.createUser({ email: 'user@example.com', displayName: 'User' });
    const target = await repo.findOrCreateTarget('https://test.com', 'key1', 'test.com');

    const pastDate = new Date(Date.now() - 5000);
    const futureDate = new Date(Date.now() + 600000);

    await repo.createWatch({
      userId: user.id,
      targetId: target.id,
      name: 'Due Watch',
      intervalMinutes: 15,
      enabled: true,
      sensitivity: 'normal',
      includeSelectors: [],
      ignoreSelectors: [],
      normalizationRules: {},
      status: 'OK',
      nextCheckAt: pastDate,
    });

    await repo.createWatch({
      userId: user.id,
      targetId: target.id,
      name: 'Future Watch',
      intervalMinutes: 60,
      enabled: true,
      sensitivity: 'normal',
      includeSelectors: [],
      ignoreSelectors: [],
      normalizationRules: {},
      status: 'OK',
      nextCheckAt: futureDate,
    });

    const due = await repo.findDueWatches(new Date());
    expect(due).toHaveLength(1);
    expect(due[0].name).toBe('Due Watch');
  });
});
