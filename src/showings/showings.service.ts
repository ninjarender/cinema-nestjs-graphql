import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter } from 'mongoose';
import { FilmsService } from '../films/films.service.js';
import { listHallSeats } from '../halls/hall-seats.js';
import { HallsService } from '../halls/halls.service.js';
import { CreateShowingInput } from './dto/create-showing.input.js';
import { ShowingsArgs } from './dto/showings.args.js';
import { ShowingPage } from './models/showing-page.model.js';
import { PopulatedShowing, Showing } from './schemas/showing.schema.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Шляхи для populate: Showing.film і Showing.hall клієнт отримує об'єктами. */
type PopulatedPaths = Pick<PopulatedShowing, 'film' | 'hall'>;
const POPULATE_PATHS = ['film', 'hall'];

/**
 * N+1 розв'язано через populate: на сторінку сеансів Mongoose робить один запит
 * до showings і по одному з $in до films і halls, а резолвери полів film/hall
 * повертають уже підставлені документи без звернення до бази.
 */
@Injectable()
export class ShowingsService {
  private readonly logger = new Logger(ShowingsService.name);

  constructor(
    @InjectModel(Showing.name)
    private readonly showingModel: Model<Showing>,
    private readonly filmsService: FilmsService,
    private readonly hallsService: HallsService,
  ) {}

  async create(input: CreateShowingInput): Promise<PopulatedShowing> {
    const film = await this.filmsService.findById(input.filmId);
    if (film === null) {
      this.logger.warn(
        `Спроба створити сеанс для неіснуючого фільму ${input.filmId}`,
      );
      throw new NotFoundException(`Фільм з id ${input.filmId} не знайдено`);
    }
    const hall = await this.hallsService.findById(input.hallId);
    if (hall === null) {
      this.logger.warn(
        `Спроба створити сеанс у неіснуючому залі ${input.hallId}`,
      );
      throw new NotFoundException(`Зал з id ${input.hallId} не знайдено`);
    }

    if (input.startsAt.getTime() <= Date.now()) {
      throw new BadRequestException('startsAt вказує на момент у минулому');
    }

    const showing = await this.showingModel.create({
      film: film._id,
      hall: hall._id,
      startsAt: input.startsAt,
      price: input.price,
      // Місця залу розгортаються в документ сеансу: 3 × 5 → 15 вільних місць
      seats: listHallSeats(hall).map(({ row, seat }) => ({
        row,
        seat,
        bookingId: null,
      })),
      bookings: [],
    });
    // Фільм і зал уже прочитані: підставляємо їх у ref-поля без повторного запиту (ручний populate)
    return Object.assign(showing, { film, hall }) as PopulatedShowing;
  }

  /** Фільтрація, сортування й сторінка — запитом до бази, total — countDocuments. */
  async findAll(args: ShowingsArgs): Promise<ShowingPage> {
    const { filmId, date, page, limit, sort } = args;

    const filter: QueryFilter<Showing> = {};
    if (filmId !== undefined) {
      filter.film = filmId;
    }
    if (date !== undefined) {
      // Доба за UTC як півінтервал [00:00, наступна 00:00) — індекс по startsAt лишається придатним
      const dayStart = new Date(`${date}T00:00:00.000Z`);
      const dayEnd = new Date(dayStart.getTime() + DAY_MS);
      filter.startsAt = { $gte: dayStart, $lt: dayEnd };
    }

    const [items, total] = await Promise.all([
      this.showingModel
        .find(filter)
        .sort({ startsAt: sort, _id: 'asc' }) // при однаковому часі — сталий порядок за _id
        .skip((page - 1) * limit)
        .limit(limit)
        .populate<PopulatedPaths>(POPULATE_PATHS),
      this.showingModel.countDocuments(filter),
    ]);

    return { items, total, page, limit };
  }

  /** Сеанс або null: query showing повертає null для неіснуючого id, а не помилку. */
  async findById(id: string): Promise<PopulatedShowing | null> {
    return this.showingModel
      .findById(id)
      .populate<PopulatedPaths>(POPULATE_PATHS);
  }
}
