import { fakerUK as faker } from '@faker-js/faker';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppModule } from './app.module.js';
import { Booking } from './bookings/schemas/booking.schema.js';
import { Film } from './films/schemas/film.schema.js';
import { listHallSeats } from './halls/hall-seats.js';
import { Hall } from './halls/schemas/hall.schema.js';
import { Seat, Showing } from './showings/schemas/showing.schema.js';

/**
 * Засівання БД: `npm run seed` (після `docker compose up -d`).
 *
 * Скрипт піднімає контекст NestJS без HTTP: підключення й валідація .env ті самі,
 * що в застосунку, а запис іде через моделі Mongoose (схеми перевіряють документи).
 *
 * Дані генерує faker з фіксованим seed, тож кожен запуск дає ті самі документи
 * з тими самими _id. Запис — upsert за _id з $setOnInsert: наявний документ
 * не змінюється, тому повторний запуск нічого не дублює.
 * ⚠️ Версія @faker-js/faker закріплена точно: інша версія з тим самим seed дає інші дані.
 */

const FAKER_SEED = 20261125;
const FILMS_COUNT = 4;
const HALLS_COUNT = 2;
const SHOWINGS_COUNT = 8;
const BOOKINGS_COUNT = 3;

const DAY_MS = 24 * 60 * 60 * 1000;
const START_HOURS = [10, 13, 16, 19, 21];

type WithId<T> = T & { _id: Types.ObjectId };

faker.seed(FAKER_SEED);

const objectId = () => new Types.ObjectId(faker.database.mongodbObjectId());

/** Сеанс через `days` діб від сьогодні о годині `hour` UTC — завжди в майбутньому. */
function daysFromNow(days: number, hour: number): Date {
  const date = new Date(Date.now() + days * DAY_MS);
  date.setUTCHours(hour, 0, 0, 0);
  return date;
}

const films: WithId<Film>[] = Array.from({ length: FILMS_COUNT }, () => ({
  _id: objectId(),
  title: faker.book.title(),
  durationMinutes: faker.number.int({ min: 75, max: 180 }),
  releaseYear: faker.number.int({ min: 1930, max: 2026 }),
}));

// Назви залів унікальні (unique-індекс у схемі)
const halls: WithId<Hall>[] = faker.helpers
  .uniqueArray(() => `Зал «${faker.location.city()}»`, HALLS_COUNT)
  .map((name) => ({
    _id: objectId(),
    name,
    rows: faker.number.int({ min: 4, max: 12 }),
    seatsPerRow: faker.number.int({ min: 6, max: 16 }),
  }));

// Кожен сеанс — у свою добу; перші сеанси гарантовано покривають усі фільми й зали.
// Місця розгортаються з розмірів залу, як це робить POST /showings.
const showings: WithId<Showing>[] = Array.from(
  { length: SHOWINGS_COUNT },
  (_, i) => {
    const hall = halls[i % halls.length];
    return {
      _id: objectId(),
      film: films[i % films.length]._id,
      hall: hall._id,
      startsAt: daysFromNow(i + 1, faker.helpers.arrayElement(START_HOURS)),
      price: faker.number.int({ min: 80, max: 250 }) * 100, // у копійках
      seats: listHallSeats(hall).map(({ row, seat }): Seat => ({
        row,
        seat,
        bookingId: null,
      })),
      bookings: [],
    };
  },
);

// Бронювання вкладаються в документ сеансу так само, як це робить POST /showings/:id/bookings
for (let i = 0; i < BOOKINGS_COUNT; i++) {
  const showing = showings[i % showings.length];
  const freeSeats = showing.seats.filter(({ bookingId }) => bookingId === null);
  const seats = faker.helpers
    .arrayElements(freeSeats, { min: 1, max: 4 })
    .map(({ row, seat }) => ({ row, seat }));

  const booking: Booking = {
    _id: objectId(),
    seats,
    totalPrice: showing.price * seats.length,
    createdAt: new Date(),
  };
  for (const seat of showing.seats) {
    if (seats.some(({ row, seat: n }) => row === seat.row && n === seat.seat)) {
      seat.bookingId = booking._id;
    }
  }
  showing.bookings.push(booking);
}

/** Upsert за _id з $setOnInsert; повертає кількість реально вставлених документів. */
async function insertMissing<T>(
  model: Model<T>,
  docs: WithId<T>[],
): Promise<number> {
  const result = await model.bulkWrite(
    docs.map((doc) => ({
      updateOne: {
        filter: { _id: doc._id },
        update: { $setOnInsert: doc },
        upsert: true,
      },
    })),
  );
  return result.upsertedCount;
}

async function seed(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const filmModel = app.get<Model<Film>>(getModelToken(Film.name));
    const hallModel = app.get<Model<Hall>>(getModelToken(Hall.name));
    const showingModel = app.get<Model<Showing>>(getModelToken(Showing.name));

    // Унікальний індекс на назві залу має існувати до першого запису
    await hallModel.init();

    const inserted = {
      films: await insertMissing(filmModel, films),
      halls: await insertMissing(hallModel, halls),
      showings: await insertMissing(showingModel, showings),
    };
    console.log('Seed завершено, додано документів:', inserted);
  } finally {
    await app.close();
  }
}

await seed();
