import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter } from 'mongoose';
import { FilmsService } from '../films/films.service.js';
import { listHallSeats } from '../halls/hall-seats.js';
import { HallsService } from '../halls/halls.service.js';
import { CreateShowingDto } from './dto/create-showing.dto.js';
import { FindShowingsQueryDto } from './dto/find-showings-query.dto.js';
import { PaginatedShowingsDto } from './dto/paginated-showings.dto.js';
import { ShowingDto } from './dto/showing.dto.js';
import { PopulatedShowing, ShowingView } from './dto/showing-view.dto.js';
import { Showing } from './schemas/showing.schema.js';
import { ShowingsCoreService } from './showings-core.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Поля сеансу для відповідей: масиви seats і bookings не читаємо взагалі. */
const SUMMARY_FIELDS = '-seats -bookings';

@Injectable()
export class ShowingsService {
  private readonly logger = new Logger(ShowingsService.name);

  constructor(
    @InjectModel(Showing.name)
    private readonly showingModel: Model<Showing>,
    private readonly showingsCore: ShowingsCoreService,
    private readonly filmsService: FilmsService,
    private readonly hallsService: HallsService,
  ) {}

  async create(dto: CreateShowingDto): Promise<ShowingDto> {
    if ((await this.filmsService.findById(dto.filmId)) === null) {
      this.logger.warn(
        `Спроба створити сеанс для неіснуючого фільму ${dto.filmId}`,
      );
      throw new BadRequestException(`Фільм з id ${dto.filmId} не знайдено`);
    }
    const hall = await this.hallsService.findById(dto.hallId);
    if (hall === null) {
      this.logger.warn(
        `Спроба створити сеанс у неіснуючому залі ${dto.hallId}`,
      );
      throw new BadRequestException(`Зал з id ${dto.hallId} не знайдено`);
    }

    const startsAt = new Date(dto.startsAt);
    if (startsAt.getTime() <= Date.now()) {
      throw new BadRequestException('startsAt вказує на момент у минулому');
    }

    const showing = await this.showingModel.create({
      film: dto.filmId,
      hall: dto.hallId,
      startsAt,
      price: dto.price,
      // Місця залу розгортаються в документ сеансу: 3 × 5 → 15 вільних місць
      seats: listHallSeats(hall).map(({ row, seat }) => ({
        row,
        seat,
        bookingId: null,
      })),
      bookings: [],
    });
    return ShowingDto.fromDocument(showing);
  }

  /** Фільтрація, сортування й сторінка — запитом до бази, total — countDocuments. */
  async findAll(query: FindShowingsQueryDto): Promise<PaginatedShowingsDto> {
    const { filmId, date, page, limit, sort } = query;

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

    const [showings, total] = await Promise.all([
      this.showingModel
        .find(filter, SUMMARY_FIELDS)
        .sort({ startsAt: sort, _id: 'asc' }) // при однаковому часі — сталий порядок за _id
        .skip((page - 1) * limit)
        .limit(limit)
        .populate<Pick<PopulatedShowing, 'film'>>('film', 'title')
        .populate<Pick<PopulatedShowing, 'hall'>>('hall', 'name'),
      this.showingModel.countDocuments(filter),
    ]);

    return {
      items: showings.map((showing) => ShowingView.fromDocument(showing)),
      total,
      page,
      limit,
    };
  }

  async findOne(id: string): Promise<ShowingView> {
    const showing = await this.showingModel
      .findById(id, SUMMARY_FIELDS)
      .populate<Pick<PopulatedShowing, 'film'>>('film', 'title')
      .populate<Pick<PopulatedShowing, 'hall'>>('hall', 'name');
    if (showing === null) {
      throw this.showingsCore.notFound(id);
    }
    return ShowingView.fromDocument(showing);
  }
}
