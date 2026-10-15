import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
    getAllCategories,
    getAllPublishers,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });

    describe('filtering', () => {
        let cat: Record<string, number>;
        let pub: Record<string, number>;

        beforeEach(async () => {
            const cs = await db
                .insert(categories)
                .values([
                    { name: 'Strategy', description: 'c' },
                    { name: 'Card', description: 'c' },
                    { name: 'Party', description: 'c' },
                ])
                .returning({ id: categories.id, name: categories.name });
            const ps = await db
                .insert(publishers)
                .values([
                    { name: 'Zeta', description: 'p' },
                    { name: 'Alpha', description: 'p' },
                ])
                .returning({ id: publishers.id, name: publishers.name });
            cat = Object.fromEntries(cs.map((c) => [c.name, c.id]));
            pub = Object.fromEntries(ps.map((p) => [p.name, p.id]));
            await db.insert(games).values([
                { title: 'A', description: 'd', categoryId: cat.Strategy, publisherId: pub.Zeta },
                { title: 'B', description: 'd', categoryId: cat.Card, publisherId: pub.Zeta },
                { title: 'C', description: 'd', categoryId: cat.Card, publisherId: pub.Alpha },
                { title: 'D', description: 'd', categoryId: cat.Party, publisherId: pub.Alpha },
            ]);
        });

        const titles = async (f: Parameters<typeof getAllGames>[1]): Promise<string[]> =>
            (await getAllGames(db, f)).map((g) => g.title);

        it('returns everything for empty filters', async () => {
            expect(await titles({})).toEqual(['A', 'B', 'C', 'D']);
            expect(await titles({ categoryIds: [] })).toEqual(['A', 'B', 'C', 'D']);
        });

        it('filters by a single category', async () => {
            expect(await titles({ categoryIds: [cat.Card] })).toEqual(['B', 'C']);
        });

        it('filters by multiple categories (any of)', async () => {
            expect(await titles({ categoryIds: [cat.Strategy, cat.Party] })).toEqual(['A', 'D']);
        });

        it('filters by publisher', async () => {
            expect(await titles({ publisherId: pub.Alpha })).toEqual(['C', 'D']);
        });

        it('combines category and publisher filters', async () => {
            expect(await titles({ categoryIds: [cat.Card], publisherId: pub.Alpha })).toEqual(['C']);
            expect(await titles({ categoryIds: [cat.Strategy], publisherId: pub.Alpha })).toEqual([]);
        });

        it('lists categories and publishers ordered by name', async () => {
            expect((await getAllCategories(db)).map((c) => c.name)).toEqual(['Card', 'Party', 'Strategy']);
            expect((await getAllPublishers(db)).map((p) => p.name)).toEqual(['Alpha', 'Zeta']);
        });
    });
});
