import { INestApplication } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Connection, Model, Types } from 'mongoose';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { Film } from './../src/films/schemas/film.schema.js';
import { Hall } from './../src/halls/schemas/hall.schema.js';
import { Showing } from './../src/showings/schemas/showing.schema.js';

const MISSING_ID = '000000000000000000000000'; // коректний ObjectId, якого немає в базі
const tomorrow = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

interface GqlResponse {
  data?: Record<string, any> | null;
  errors?: { message: string; extensions?: { code?: string } }[];
}

describe('Cinema GraphQL API (e2e)', () => {
  let app: INestApplication<App>;
  let showingModel: Model<Showing>;
  let filmModel: Model<Film>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ logger: false });
    await app.init();

    // Запобіжник: колекції очищаються, тож лише база *_test (test/setup-e2e.ts)
    expect(app.get<Connection>(getConnectionToken()).name).toMatch(/_test$/);

    // Кожен тест — з чистого аркуша; індекси лишаються (deleteMany, а не drop)
    const models = [Film, Hall, Showing].map((schema) =>
      app.get<Model<unknown>>(getModelToken(schema.name)),
    );
    await Promise.all(models.map((model) => model.init()));
    await Promise.all(models.map((model) => model.deleteMany({})));
    showingModel = app.get<Model<Showing>>(getModelToken(Showing.name));
    filmModel = app.get<Model<Film>>(getModelToken(Film.name));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await app.close();
  });

  /** Одна адреса для всіх операцій; помилки виконання приходять з HTTP 200 у масиві errors. */
  async function gql(
    query: string,
    variables: Record<string, unknown> = {},
  ): Promise<GqlResponse> {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query, variables });
    return res.body as GqlResponse;
  }

  /** Успішна операція: без errors, повертає data. */
  async function ok(query: string, variables?: Record<string, unknown>) {
    const body = await gql(query, variables);
    expect(body.errors).toBeUndefined();
    return body.data!;
  }

  /** Код першої помилки — так клієнт розрізняє випадки. */
  async function errorCode(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<string | undefined> {
    const body = await gql(query, variables);
    expect(body.errors).toBeDefined();
    return body.errors![0].extensions?.code;
  }

  const CREATE_FILM = `mutation ($input: CreateFilmInput!) { createFilm(input: $input) { id title durationMinutes releaseYear } }`;
  const CREATE_HALL = `mutation ($input: CreateHallInput!) { createHall(input: $input) { id name rows seatsPerRow } }`;
  const CREATE_SHOWING = `mutation ($input: CreateShowingInput!) { createShowing(input: $input) { id startsAt price film { id title } hall { id name } } }`;
  const CREATE_BOOKING = `mutation ($showingId: ID!, $seats: [SeatInput!]!) { createBooking(showingId: $showingId, seats: $seats) { id showingId totalPrice createdAt seats { row seat } } }`;
  const SHOWINGS = `query ($filmId: ID, $date: String, $page: Int, $limit: Int, $sort: SortOrder) {
    showings(filmId: $filmId, date: $date, page: $page, limit: $limit, sort: $sort) {
      total page limit items { id startsAt film { title } hall { name } }
    }
  }`;

  async function createFilm(title = 'Тіні забутих предків') {
    const data = await ok(CREATE_FILM, {
      input: { title, durationMinutes: 97, releaseYear: 1965 },
    });
    return data.createFilm.id as string;
  }

  async function createHall(name = 'Зал 1', rows = 3, seatsPerRow = 5) {
    const data = await ok(CREATE_HALL, { input: { name, rows, seatsPerRow } });
    return data.createHall.id as string;
  }

  async function createShowing(
    filmId: string,
    hallId: string,
    startsAt = tomorrow(),
    price = 12500,
  ) {
    const data = await ok(CREATE_SHOWING, {
      input: { filmId, hallId, startsAt, price },
    });
    return data.createShowing.id as string;
  }

  async function bookedSeats(showingId: string) {
    const data = await ok(
      `query ($id: ID!) { showing(id: $id) { seats { row seat isBooked } } }`,
      { id: showingId },
    );
    return (
      data.showing.seats as { row: number; seat: number; isBooked: boolean }[]
    ).filter((seat) => seat.isBooked);
  }

  it('serves the code-first schema on /graphql', async () => {
    const data = await ok(`{ __type(name: "Showing") { fields { name } } }`);
    expect(
      data.__type.fields.map((f: { name: string }) => f.name).sort(),
    ).toEqual(['bookings', 'film', 'hall', 'id', 'price', 'seats', 'startsAt']);
  });

  describe('films', () => {
    it('creates, reads, updates and deletes a film', async () => {
      const id = await createFilm();

      const one = await ok(`query ($id: ID!) { film(id: $id) { id title } }`, {
        id,
      });
      expect(one.film).toEqual({ id, title: 'Тіні забутих предків' });

      const updated = await ok(
        `mutation ($id: ID!, $input: UpdateFilmInput!) { updateFilm(id: $id, input: $input) { id title durationMinutes releaseYear } }`,
        { id, input: { durationMinutes: 98 } },
      );
      expect(updated.updateFilm).toEqual({
        id,
        title: 'Тіні забутих предків',
        durationMinutes: 98,
        releaseYear: 1965,
      });

      const deleted = await ok(`mutation ($id: ID!) { deleteFilm(id: $id) }`, {
        id,
      });
      expect(deleted.deleteFilm).toBe(true);

      // неіснуючий документ у query — null без помилки
      const missing = await ok(`query ($id: ID!) { film(id: $id) { id } }`, {
        id,
      });
      expect(missing.film).toBeNull();
      expect((await ok(`{ films { id } }`)).films).toEqual([]);
    });

    it('returns NOT_FOUND for mutations on a missing film', async () => {
      expect(
        await errorCode(
          `mutation ($id: ID!) { updateFilm(id: $id, input: { title: "X" }) { id } }`,
          { id: MISSING_ID },
        ),
      ).toBe('NOT_FOUND');
      expect(
        await errorCode(`mutation ($id: ID!) { deleteFilm(id: $id) }`, {
          id: MISSING_ID,
        }),
      ).toBe('NOT_FOUND');
    });

    it('validates input with class-validator → BAD_USER_INPUT', async () => {
      for (const input of [
        { title: '   ', durationMinutes: 97, releaseYear: 1965 },
        { title: 'X', durationMinutes: 0, releaseYear: 1965 },
        { title: 'X', durationMinutes: 97, releaseYear: 1700 },
        { title: 'X'.repeat(256), durationMinutes: 97, releaseYear: 1965 },
      ]) {
        expect(await errorCode(CREATE_FILM, { input })).toBe('BAD_USER_INPUT');
      }
      // явний null в оновленні не доходить до бази
      const id = await createFilm();
      expect(
        await errorCode(
          `mutation ($id: ID!) { updateFilm(id: $id, input: { title: null }) { id } }`,
          { id },
        ),
      ).toBe('BAD_USER_INPUT');
    });

    it('returns CONFLICT when a showing references the film or hall', async () => {
      const filmId = await createFilm();
      const hallId = await createHall();
      await createShowing(filmId, hallId);

      expect(
        await errorCode(`mutation ($id: ID!) { deleteFilm(id: $id) }`, {
          id: filmId,
        }),
      ).toBe('CONFLICT');
      expect(
        await errorCode(`mutation ($id: ID!) { deleteHall(id: $id) }`, {
          id: hallId,
        }),
      ).toBe('CONFLICT');
    });
  });

  describe('halls', () => {
    it('creates, reads and deletes a hall; no seats field on Hall', async () => {
      const id = await createHall('Зал 1', 3, 5);
      const data = await ok(
        `query ($id: ID!) { hall(id: $id) { id name rows seatsPerRow } }`,
        { id },
      );
      expect(data.hall).toEqual({ id, name: 'Зал 1', rows: 3, seatsPerRow: 5 });
      expect(
        await errorCode(
          `query ($id: ID!) { hall(id: $id) { seats { row } } }`,
          {
            id,
          },
        ),
      ).toBe('GRAPHQL_VALIDATION_FAILED');

      expect(
        (await ok(`mutation ($id: ID!) { deleteHall(id: $id) }`, { id }))
          .deleteHall,
      ).toBe(true);
      expect(
        (await ok(`query ($id: ID!) { hall(id: $id) { id } }`, { id })).hall,
      ).toBeNull();
      expect(
        await errorCode(`mutation ($id: ID!) { deleteHall(id: $id) }`, { id }),
      ).toBe('NOT_FOUND');
    });

    it('keeps hall names unique regardless of case → CONFLICT', async () => {
      await createHall('Зал 1');
      expect(
        await errorCode(CREATE_HALL, {
          input: { name: 'зал 1', rows: 1, seatsPerRow: 1 },
        }),
      ).toBe('CONFLICT');
    });

    it('keeps names unique under concurrent requests', async () => {
      const results = await Promise.all(
        ['Зал Х', 'зал х', 'ЗАЛ Х'].map((name) =>
          gql(CREATE_HALL, { input: { name, rows: 1, seatsPerRow: 1 } }),
        ),
      );
      const codes = results
        .map((body) => body.errors?.[0].extensions?.code ?? 'OK')
        .sort();
      expect(codes).toEqual(['CONFLICT', 'CONFLICT', 'OK']);
    });

    it('rejects non-positive sizes → BAD_USER_INPUT', async () => {
      expect(
        await errorCode(CREATE_HALL, {
          input: { name: 'X', rows: 2, seatsPerRow: 0 },
        }),
      ).toBe('BAD_USER_INPUT');
    });
  });

  describe('showings', () => {
    it('creates a showing with nested film and hall, seats filled, no bookings', async () => {
      const filmId = await createFilm();
      const hallId = await createHall('Зал 1', 3, 5);
      const data = await ok(
        `mutation ($input: CreateShowingInput!) { createShowing(input: $input) {
          id price film { id title } hall { id name } seats { row seat isBooked } bookings { id }
        } }`,
        {
          input: {
            filmId,
            hallId,
            startsAt: '2030-05-02T18:30:00Z',
            price: 12500,
          },
        },
      );

      expect(data.createShowing).toMatchObject({
        price: 12500,
        film: { id: filmId, title: 'Тіні забутих предків' },
        hall: { id: hallId, name: 'Зал 1' },
        bookings: [],
      });
      expect(data.createShowing.seats).toHaveLength(15);
      expect(data.createShowing.seats[14]).toEqual({
        row: 3,
        seat: 5,
        isBooked: false,
      });
      const stored = await showingModel.findById(data.createShowing.id).lean();
      expect(stored!.seats.every((s) => s.bookingId === null)).toBe(true);
      expect(stored!.bookings).toEqual([]);
    });

    it('returns NOT_FOUND for a missing film or hall and BAD_USER_INPUT for bad values', async () => {
      const filmId = await createFilm();
      const hallId = await createHall();
      const base = { filmId, hallId, startsAt: tomorrow(), price: 100 };

      expect(
        await errorCode(CREATE_SHOWING, {
          input: { ...base, filmId: MISSING_ID },
        }),
      ).toBe('NOT_FOUND');
      expect(
        await errorCode(CREATE_SHOWING, {
          input: { ...base, hallId: MISSING_ID },
        }),
      ).toBe('NOT_FOUND');
      for (const input of [
        { ...base, startsAt: '2020-01-01T10:00:00Z' },
        { ...base, startsAt: 'not-a-date' },
        // вбудований скаляр Nest прийняв би все, що розбирає new Date()
        { ...base, startsAt: '12/25/2030' },
        { ...base, startsAt: 'May 2 2030 18:30' },
        { ...base, startsAt: 1924992000000 },
        { ...base, price: 0 },
        { ...base, price: -5 },
        { ...base, price: 1.5 },
      ]) {
        expect(await errorCode(CREATE_SHOWING, { input })).toBe(
          'BAD_USER_INPUT',
        );
      }
    });

    it('filters by film and date, sorts by start time, then id', async () => {
      const filmA = await createFilm('A');
      const filmB = await createFilm('B');
      const hallId = await createHall();

      await createShowing(filmA, hallId, '2030-05-02T20:00:00Z');
      await createShowing(filmA, hallId, '2030-05-02T10:00:00Z');
      await createShowing(filmA, hallId, '2030-05-02T10:00:00Z');
      await createShowing(filmA, hallId, '2030-05-03T10:00:00Z');
      await createShowing(filmB, hallId, '2030-05-02T12:00:00Z');

      const { showings } = await ok(SHOWINGS, {
        filmId: filmA,
        date: '2030-05-02',
      });
      expect(showings).toMatchObject({ total: 3, page: 1, limit: 20 });
      const items = showings.items as { id: string; startsAt: string }[];
      expect(items.map((s) => s.startsAt)).toEqual([
        '2030-05-02T10:00:00.000Z',
        '2030-05-02T10:00:00.000Z',
        '2030-05-02T20:00:00.000Z',
      ]);
      expect(items[0].id < items[1].id).toBe(true);
      expect(items[0]).toMatchObject({
        film: { title: 'A' },
        hall: { name: 'Зал 1' },
      });
    });

    it('paginates and sorts in the database', async () => {
      const filmId = await createFilm();
      const hallId = await createHall();
      for (const day of ['01', '02', '03', '04', '05']) {
        await createShowing(filmId, hallId, `2030-06-${day}T10:00:00Z`);
      }

      const page2 = (await ok(SHOWINGS, { page: 2, limit: 2 })).showings;
      expect(page2).toMatchObject({ total: 5, page: 2, limit: 2 });
      expect(page2.items.map((s: { startsAt: string }) => s.startsAt)).toEqual([
        '2030-06-03T10:00:00.000Z',
        '2030-06-04T10:00:00.000Z',
      ]);

      const desc = (await ok(SHOWINGS, { sort: 'DESC', limit: 1 })).showings;
      expect(desc.total).toBe(5);
      expect(desc.items).toHaveLength(1);
      expect(desc.items[0].startsAt).toBe('2030-06-05T10:00:00.000Z');

      // явний null — як пропущений аргумент
      const defaults = (
        await ok(SHOWINGS, {
          filmId: null,
          date: null,
          page: null,
          limit: null,
          sort: null,
        })
      ).showings;
      expect(defaults).toMatchObject({ total: 5, page: 1, limit: 20 });

      for (const variables of [
        { page: 0 },
        { limit: 0 },
        { limit: 101 },
        { date: '02.05.2030' },
        { date: '2030-02-30' },
        { filmId: 'not-an-object-id' },
      ]) {
        expect(await errorCode(SHOWINGS, variables)).toBe('BAD_USER_INPUT');
      }
    });

    it('resolves film and hall of a page without a query per showing (N+1)', async () => {
      const filmA = await createFilm('A');
      const filmB = await createFilm('B');
      const hallId = await createHall();
      for (let i = 0; i < 6; i++) {
        await createShowing(i % 2 ? filmA : filmB, hallId);
      }

      // Той самий лог, що вмикає MONGOOSE_DEBUG: рахуємо запити за колекціями
      const queries: string[] = [];
      app
        .get<Connection>(getConnectionToken())
        .set('debug', (collection: string) => queries.push(collection));

      const { showings } = await ok(SHOWINGS);
      expect(showings.items).toHaveLength(6);
      expect(queries.filter((c) => c === 'films')).toHaveLength(1);
      expect(queries.filter((c) => c === 'halls')).toHaveLength(1);
    });
  });

  describe('bookings', () => {
    it('books seats, rejects conflicts atomically and frees seats on cancel', async () => {
      const showingId = await createShowing(
        await createFilm(),
        await createHall('Зал 1', 3, 5),
      );

      const { createBooking } = await ok(CREATE_BOOKING, {
        showingId,
        seats: [
          { row: 1, seat: 5 },
          { row: 1, seat: 4 },
        ],
      });
      expect(createBooking).toMatchObject({
        showingId,
        totalPrice: 25000,
        seats: [
          { row: 1, seat: 4 },
          { row: 1, seat: 5 },
        ],
      });

      // одне з місць зайняте → CONFLICT, і ряд 2 місце 1 не бронюється
      expect(
        await errorCode(CREATE_BOOKING, {
          showingId,
          seats: [
            { row: 2, seat: 1 },
            { row: 1, seat: 5 },
          ],
        }),
      ).toBe('CONFLICT');
      expect(await bookedSeats(showingId)).toHaveLength(2);

      const listed = await ok(
        `query ($id: ID!) { bookings { id showingId } showing(id: $id) { bookings { id showingId totalPrice } } }`,
        { id: showingId },
      );
      expect(listed.bookings).toEqual([{ id: createBooking.id, showingId }]);
      expect(listed.showing.bookings).toEqual([
        { id: createBooking.id, showingId, totalPrice: 25000 },
      ]);

      const cancel = `mutation ($id: ID!) { cancelBooking(id: $id) }`;
      expect((await ok(cancel, { id: createBooking.id })).cancelBooking).toBe(
        true,
      );
      expect(await bookedSeats(showingId)).toHaveLength(0);
      const stored = await showingModel.findById(showingId).lean();
      expect(stored!.bookings).toEqual([]);
      expect(await errorCode(cancel, { id: createBooking.id })).toBe(
        'NOT_FOUND',
      );
    });

    it('stores the booking inside the showing document', async () => {
      const showingId = await createShowing(
        await createFilm(),
        await createHall('Зал 1', 3, 5),
      );
      const { createBooking } = await ok(CREATE_BOOKING, {
        showingId,
        seats: [{ row: 3, seat: 5 }],
      });

      const stored = await showingModel.findById(showingId).lean();
      expect(stored!.bookings).toHaveLength(1);
      expect(stored!.bookings[0]._id.toString()).toBe(createBooking.id);
      expect(stored!.seats.filter((s) => s.bookingId !== null)).toEqual([
        { row: 3, seat: 5, bookingId: stored!.bookings[0]._id },
      ]);
    });

    it('sells a seat only once under concurrent requests', async () => {
      const showingId = await createShowing(
        await createFilm(),
        await createHall('Зал 1', 3, 5),
      );
      const book = () =>
        gql(CREATE_BOOKING, { showingId, seats: [{ row: 2, seat: 2 }] });

      const codes = (await Promise.all([book(), book(), book()]))
        .map((body) => body.errors?.[0].extensions?.code ?? 'OK')
        .sort();
      expect(codes).toEqual(['CONFLICT', 'CONFLICT', 'OK']);
      expect((await ok(`{ bookings { id } }`)).bookings).toHaveLength(1);
    });

    it('rejects invalid seat lists before the update', async () => {
      const showingId = await createShowing(
        await createFilm(),
        await createHall('Зал 1', 3, 5),
      );
      for (const seats of [
        [],
        [
          { row: 1, seat: 1 },
          { row: 1, seat: 1 },
        ],
        [{ row: 0, seat: 1 }],
        [{ row: 4, seat: 1 }],
        [{ row: 1, seat: 6 }],
      ]) {
        expect(await errorCode(CREATE_BOOKING, { showingId, seats })).toBe(
          'BAD_USER_INPUT',
        );
      }
      expect(
        await errorCode(CREATE_BOOKING, {
          showingId: MISSING_ID,
          seats: [{ row: 1, seat: 1 }],
        }),
      ).toBe('NOT_FOUND');
      expect(await bookedSeats(showingId)).toHaveLength(0);
    });
  });

  describe('errors', () => {
    it('answers plain HTTP errors outside GraphQL instead of hanging', async () => {
      await request(app.getHttpServer()).get('/').expect(404);
      await request(app.getHttpServer())
        .post('/graphql')
        .set('Content-Type', 'application/json')
        .send('{"query": ')
        .expect(400);
    });

    it('rejects a malformed id with BAD_USER_INPUT before touching the database', async () => {
      const operations = [
        `query ($id: ID!) { film(id: $id) { id } }`,
        `query ($id: ID!) { hall(id: $id) { id } }`,
        `query ($id: ID!) { showing(id: $id) { id } }`,
        `mutation ($id: ID!) { updateFilm(id: $id, input: { title: "X" }) { id } }`,
        `mutation ($id: ID!) { deleteFilm(id: $id) }`,
        `mutation ($id: ID!) { deleteHall(id: $id) }`,
        `mutation ($id: ID!) { cancelBooking(id: $id) }`,
        `mutation ($id: ID!) { createBooking(showingId: $id, seats: [{ row: 1, seat: 1 }]) { id } }`,
        `mutation ($id: ID!) { createShowing(input: { filmId: $id, hallId: "${MISSING_ID}", startsAt: "${tomorrow()}", price: 100 }) { id } }`,
      ];
      for (const query of operations) {
        const body = await gql(query, { id: 'abc' });
        expect(body.errors![0].extensions?.code).toBe('BAD_USER_INPUT');
        expect(body.errors![0].message).toContain('ObjectId');
      }
      // ObjectId у верхньому регістрі нормалізується
      const id = await createFilm();
      const upper = await ok(`query ($id: ID!) { film(id: $id) { id } }`, {
        id: id.toUpperCase(),
      });
      expect(upper.film).toEqual({ id });
    });

    it('hides database error details in a resolver', async () => {
      vi.spyOn(filmModel, 'find').mockImplementation(() => {
        throw new Error(
          'MongoServerError: connection to 10.0.0.5:27017 refused',
        );
      });

      const body = await gql(`{ films { id } }`);
      expect(body.errors).toEqual([
        expect.objectContaining({
          message: 'Internal server error',
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        }),
      ]);
      expect(JSON.stringify(body)).not.toContain('10.0.0.5');
    });

    it('hides details of errors outside root resolvers (formatError)', async () => {
      // Сеанс посилається на фільм, якого немає: Showing.film (Film!) отримує null
      const hallId = await createHall();
      const showing = await showingModel.create({
        film: new Types.ObjectId(),
        hall: hallId,
        startsAt: tomorrow(),
        price: 100,
      });

      const body = await gql(
        `query ($id: ID!) { showing(id: $id) { film { title } } }`,
        {
          id: showing._id.toString(),
        },
      );
      expect(body.data).toEqual({ showing: null });
      expect(body.errors).toEqual([
        expect.objectContaining({
          message: 'Internal server error',
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        }),
      ]);
    });
  });
});
