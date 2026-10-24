import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Model } from 'mongoose';
import { existsSync } from 'node:fs';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { Film } from './../src/films/schemas/film.schema.js';
import { Hall } from './../src/halls/schemas/hall.schema.js';
import { Showing } from './../src/showings/schemas/showing.schema.js';

// e2e працює з окремою базою <db>_test, щоб не чіпати дані розробки.
// ConfigModule не перезаписує змінні, які вже є в process.env.
if (existsSync('.env')) {
  process.loadEnvFile(); // у CI змінні можуть прийти з оточення без файла
}
const uri = new URL(process.env.MONGODB_URI!);
uri.pathname = `${uri.pathname.length > 1 ? uri.pathname : '/cinema'}_test`;
process.env.MONGODB_URI = uri.toString();

const MISSING_ID = '000000000000000000000000'; // коректний ObjectId, якого немає в базі
const tomorrow = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

describe('Cinema API (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let showingModel: Model<Showing>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    http = request(app.getHttpServer());

    // Кожен тест — з чистого аркуша; індекси лишаються (deleteMany, а не drop)
    const models = [Film, Hall, Showing].map((schema) =>
      app.get<Model<unknown>>(getModelToken(schema.name)),
    );
    await Promise.all(models.map((model) => model.init()));
    await Promise.all(models.map((model) => model.deleteMany({})));
    showingModel = app.get<Model<Showing>>(getModelToken(Showing.name));
  });

  afterEach(async () => {
    await app.close();
  });

  async function createFilm(title = 'Тіні забутих предків') {
    const res = await http
      .post('/films')
      .send({ title, durationMinutes: 97, releaseYear: 1965 })
      .expect(201);
    return res.body.id as string;
  }

  async function createHall(name = 'Зал 1', rows = 3, seatsPerRow = 5) {
    const res = await http
      .post('/halls')
      .send({ name, rows, seatsPerRow })
      .expect(201);
    return res.body.id as string;
  }

  async function createShowing(
    filmId: string,
    hallId: string,
    startsAt = tomorrow(),
    price = 12500,
  ) {
    const res = await http
      .post('/showings')
      .send({ filmId, hallId, startsAt, price })
      .expect(201);
    return res.body.id as string;
  }

  describe('films', () => {
    it('creates, reads, updates and deletes a film', async () => {
      const id = await createFilm();

      await http.get(`/films/${id}`).expect(200);
      const updated = await http
        .patch(`/films/${id}`)
        .send({ durationMinutes: 98, unknownField: 'stripped' })
        .expect(200);
      expect(updated.body).toEqual({
        id,
        title: 'Тіні забутих предків',
        durationMinutes: 98,
        releaseYear: 1965,
      });

      await http.delete(`/films/${id}`).expect(204);
      const notFound = await http.get(`/films/${id}`).expect(404);
      // єдиний формат помилки від глобального HttpExceptionFilter
      expect(notFound.body).toEqual({
        statusCode: 404,
        timestamp: expect.any(String),
        path: `/films/${id}`,
        message: `Фільм з id ${id} не знайдено`,
      });
    });

    it('rejects a film with a missing or mistyped field', async () => {
      await http
        .post('/films')
        .send({ title: 'X', releaseYear: 2000 })
        .expect(400);
      await http
        .post('/films')
        .send({ title: 'X', durationMinutes: '97', releaseYear: 2000 })
        .expect(400);
    });

    it('returns 409 when a showing references the film', async () => {
      const filmId = await createFilm();
      const hallId = await createHall();
      await createShowing(filmId, hallId);

      await http.delete(`/films/${filmId}`).expect(409);
      await http.delete(`/halls/${hallId}`).expect(409);
    });
  });

  describe('halls', () => {
    it('returns the full seat list', async () => {
      const id = await createHall('Зал 1', 3, 5);
      const res = await http.get(`/halls/${id}`).expect(200);
      expect(res.body.seats).toHaveLength(15);
      expect(res.body.seats[0]).toEqual({ row: 1, seat: 1 });
      expect(res.body.seats[14]).toEqual({ row: 3, seat: 5 });
    });

    it('keeps hall names unique', async () => {
      await createHall('Зал 1');
      await http
        .post('/halls')
        .send({ name: 'Зал 1', rows: 1, seatsPerRow: 1 })
        .expect(409);
    });

    it('rejects non-positive and non-integer sizes', async () => {
      await http
        .post('/halls')
        .send({ name: 'X', rows: 2.5, seatsPerRow: 0 })
        .expect(400);
    });
  });

  describe('showings', () => {
    it('validates film, hall, date and price', async () => {
      const filmId = await createFilm();
      const hallId = await createHall();
      const base = { filmId, hallId, startsAt: tomorrow(), price: 100 };

      await http
        .post('/showings')
        .send({ ...base, filmId: MISSING_ID })
        .expect(400);
      await http
        .post('/showings')
        .send({ ...base, hallId: MISSING_ID })
        .expect(400);
      await http
        .post('/showings')
        .send({ ...base, startsAt: 'not-a-date' })
        .expect(400);
      await http
        .post('/showings')
        .send({ ...base, startsAt: '2020-01-01T10:00:00Z' })
        .expect(400);
      await http
        .post('/showings')
        .send({ ...base, price: 1.5 })
        .expect(400);
    });

    it('filters by film and date and sorts by start time, then id', async () => {
      const filmA = await createFilm('A');
      const filmB = await createFilm('B');
      const hallId = await createHall();

      await createShowing(filmA, hallId, '2030-05-02T20:00:00Z');
      await createShowing(filmA, hallId, '2030-05-02T10:00:00Z');
      await createShowing(filmA, hallId, '2030-05-02T10:00:00Z');
      await createShowing(filmA, hallId, '2030-05-03T10:00:00Z');
      await createShowing(filmB, hallId, '2030-05-02T12:00:00Z');

      const res = await http
        .get('/showings')
        .query({ filmId: filmA, date: '2030-05-02' })
        .expect(200);

      expect(res.body).toMatchObject({ total: 3, page: 1, limit: 20 });
      const items = res.body.items;
      expect(items.map((s: { startsAt: string }) => s.startsAt)).toEqual([
        '2030-05-02T10:00:00.000Z',
        '2030-05-02T10:00:00.000Z',
        '2030-05-02T20:00:00.000Z',
      ]);
      expect(items[0].id < items[1].id).toBe(true);
      expect(items[0]).toMatchObject({ filmTitle: 'A', hallName: 'Зал 1' });
      expect(items[0]).not.toHaveProperty('filmId');
      expect(items[0]).not.toHaveProperty('seats');
      expect(items[0]).not.toHaveProperty('bookings');

      await http.get('/showings').query({ date: '02.05.2030' }).expect(400);
    });

    it('paginates and sorts in the database', async () => {
      const filmId = await createFilm();
      const hallId = await createHall();
      for (const day of ['01', '02', '03', '04', '05']) {
        await createShowing(filmId, hallId, `2030-06-${day}T10:00:00Z`);
      }

      const page2 = await http
        .get('/showings')
        .query({ page: 2, limit: 2 })
        .expect(200);
      expect(page2.body).toMatchObject({ total: 5, page: 2, limit: 2 });
      expect(
        page2.body.items.map((s: { startsAt: string }) => s.startsAt),
      ).toEqual(['2030-06-03T10:00:00.000Z', '2030-06-04T10:00:00.000Z']);

      const desc = await http
        .get('/showings')
        .query({ sort: 'desc', limit: 1 })
        .expect(200);
      expect(desc.body.total).toBe(5);
      expect(desc.body.items).toHaveLength(1);
      expect(desc.body.items[0].startsAt).toBe('2030-06-05T10:00:00.000Z');

      for (const query of [
        { page: 0 },
        { page: 1.5 },
        { limit: 0 },
        { limit: 101 },
        { limit: 'ten' },
        { sort: 'up' },
        { filmId: 'not-an-object-id' },
      ]) {
        await http.get('/showings').query(query).expect(400);
      }
    });
  });

  describe('bookings', () => {
    it('books seats, rejects conflicts atomically and frees seats on cancel', async () => {
      const showingId = await createShowing(
        await createFilm(),
        await createHall('Зал 1', 3, 5),
      );

      const booking = await http
        .post(`/showings/${showingId}/bookings`)
        .send({
          seats: [
            { row: 1, seat: 4 },
            { row: 1, seat: 5 },
          ],
        })
        .expect(201);
      expect(booking.body.totalPrice).toBe(25000);

      // одне з місць зайняте → 409 і ряд 2 місце 1 не бронюється
      await http
        .post(`/showings/${showingId}/bookings`)
        .send({
          seats: [
            { row: 2, seat: 1 },
            { row: 1, seat: 5 },
          ],
        })
        .expect(409);

      const booked = async () => {
        const res = await http.get(`/showings/${showingId}/seats`).expect(200);
        expect(res.body).toHaveLength(15);
        return res.body.filter((s: { isBooked: boolean }) => s.isBooked).length;
      };
      expect(await booked()).toBe(2);
      const all = await http.get('/bookings').expect(200);
      expect(all.body).toHaveLength(1);

      await http.delete(`/bookings/${booking.body.id}`).expect(204);
      expect(await booked()).toBe(0);
      await http.delete(`/bookings/${booking.body.id}`).expect(404);
    });

    it('sells a seat only once under concurrent requests', async () => {
      const showingId = await createShowing(
        await createFilm(),
        await createHall('Зал 1', 3, 5),
      );
      const book = () =>
        http
          .post(`/showings/${showingId}/bookings`)
          .send({ seats: [{ row: 2, seat: 2 }] });

      const statuses = (await Promise.all([book(), book(), book()]))
        .map((res) => res.status)
        .sort((a, b) => a - b);
      expect(statuses).toEqual([201, 409, 409]);

      const bookings = await http
        .get(`/showings/${showingId}/bookings`)
        .expect(200);
      expect(bookings.body).toHaveLength(1);
    });

    it('rejects invalid seat lists', async () => {
      const showingId = await createShowing(
        await createFilm(),
        await createHall('Зал 1', 3, 5),
      );
      const book = (seats: unknown) =>
        http.post(`/showings/${showingId}/bookings`).send({ seats });

      await book([]).expect(400);
      await book([{ row: 1 }]).expect(400);
      await book([
        { row: 1, seat: 1 },
        { row: 1, seat: 1 },
      ]).expect(400);
      await book([{ row: 4, seat: 1 }]).expect(400);
      await book([{ row: 1, seat: 6 }]).expect(400);
      await http
        .post(`/showings/${MISSING_ID}/bookings`)
        .send({ seats: [{ row: 1, seat: 1 }] })
        .expect(404);
    });
  });

  describe('identifiers', () => {
    it('rejects a malformed id with 400 before touching the database', async () => {
      for (const path of [
        '/films/abc',
        '/halls/abc',
        '/showings/abc',
        '/showings/abc/seats',
        '/showings/abc/bookings',
      ]) {
        const res = await http.get(path).expect(400);
        expect(res.body.message).toContain('ObjectId');
      }
      await http.patch('/films/abc').send({ title: 'X' }).expect(400);
      await http.delete('/films/abc').expect(400);
      await http.delete('/halls/abc').expect(400);
      await http.delete('/bookings/abc').expect(400);
      await http
        .post('/showings/abc/bookings')
        .send({ seats: [{ row: 1, seat: 1 }] })
        .expect(400);
      await http
        .post('/showings')
        .send({
          filmId: 'abc',
          hallId: MISSING_ID,
          startsAt: tomorrow(),
          price: 100,
        })
        .expect(400);
    });

    it('returns a string id and no internal Mongoose fields', async () => {
      const res = await http
        .post('/films')
        .send({ title: 'Земля', durationMinutes: 75, releaseYear: 1930 })
        .expect(201);
      expect(res.body).toEqual({
        id: expect.stringMatching(/^[0-9a-f]{24}$/),
        title: 'Земля',
        durationMinutes: 75,
        releaseYear: 1930,
      });
      await http.get(`/films/${MISSING_ID}`).expect(404);
      // ObjectId у верхньому регістрі нормалізується
      await http.get(`/films/${res.body.id.toUpperCase()}`).expect(200);
    });
  });

  describe('document model', () => {
    it('fills seats on showing creation and keeps them out of the response', async () => {
      const filmId = await createFilm();
      const hallId = await createHall('Зал 1', 3, 5);
      const res = await http
        .post('/showings')
        .send({ filmId, hallId, startsAt: tomorrow(), price: 12500 })
        .expect(201);

      expect(res.body).toEqual({
        id: expect.any(String),
        filmId,
        hallId,
        startsAt: expect.any(String),
        price: 12500,
      });
      const stored = await showingModel.findById(res.body.id).lean();
      expect(stored!.seats).toHaveLength(15);
      expect(stored!.seats.every((s) => s.bookingId === null)).toBe(true);
      expect(stored!.bookings).toEqual([]);

      const one = await http.get(`/showings/${res.body.id}`).expect(200);
      expect(one.body).toEqual({
        id: res.body.id,
        filmTitle: 'Тіні забутих предків',
        hallName: 'Зал 1',
        startsAt: expect.any(String),
        price: 12500,
      });
    });

    it('stores a booking inside the showing document and removes it on cancel', async () => {
      const showingId = await createShowing(
        await createFilm(),
        await createHall('Зал 1', 3, 5),
      );
      const booking = await http
        .post(`/showings/${showingId}/bookings`)
        .send({ seats: [{ row: 3, seat: 5 }] })
        .expect(201);

      let stored = await showingModel.findById(showingId).lean();
      expect(stored!.bookings).toHaveLength(1);
      expect(stored!.bookings[0]._id.toString()).toBe(booking.body.id);
      const taken = stored!.seats.filter((s) => s.bookingId !== null);
      expect(taken).toEqual([
        { row: 3, seat: 5, bookingId: stored!.bookings[0]._id },
      ]);

      await http.delete(`/bookings/${booking.body.id}`).expect(204);
      stored = await showingModel.findById(showingId).lean();
      expect(stored!.bookings).toEqual([]);
      expect(stored!.seats.every((s) => s.bookingId === null)).toBe(true);
    });

    it('treats hall names as unique regardless of case', async () => {
      await createHall('Зал 1');
      await http
        .post('/halls')
        .send({ name: 'зал 1', rows: 1, seatsPerRow: 1 })
        .expect(409);
    });

    it('keeps names unique regardless of case under concurrent requests', async () => {
      const statuses = (
        await Promise.all(
          ['Зал Х', 'зал х', 'ЗАЛ Х'].map((name) =>
            http.post('/halls').send({ name, rows: 1, seatsPerRow: 1 }),
          ),
        )
      )
        .map((res) => res.status)
        .sort((a, b) => a - b);
      expect(statuses).toEqual([201, 409, 409]);
    });
  });
});
