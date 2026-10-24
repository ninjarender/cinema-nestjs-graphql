import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ShowingsCoreService } from '../showings/showings-core.service.js';
import { CreateFilmDto } from './dto/create-film.dto.js';
import { FilmDto } from './dto/film.dto.js';
import { UpdateFilmDto } from './dto/update-film.dto.js';
import { Film, FilmDocument } from './schemas/film.schema.js';

@Injectable()
export class FilmsService {
  private readonly logger = new Logger(FilmsService.name);

  constructor(
    @InjectModel(Film.name)
    private readonly filmModel: Model<Film>,
    private readonly showingsCore: ShowingsCoreService,
  ) {}

  async create(dto: CreateFilmDto): Promise<FilmDto> {
    const film = await this.filmModel.create(dto);
    return FilmDto.fromDocument(film);
  }

  async findAll(): Promise<FilmDto[]> {
    const films = await this.filmModel.find().sort({ _id: 1 });
    return films.map((film) => FilmDto.fromDocument(film));
  }

  async findOne(id: string): Promise<FilmDto> {
    const film = await this.findById(id);
    if (film === null) {
      throw this.notFound(id);
    }
    return FilmDto.fromDocument(film);
  }

  /** Те саме, що findOne, але без винятку — для перевірок в інших модулях. */
  async findById(id: string): Promise<FilmDocument | null> {
    return this.filmModel.findById(id);
  }

  async update(id: string, dto: UpdateFilmDto): Promise<FilmDto> {
    const film = await this.filmModel.findByIdAndUpdate(id, dto, {
      returnDocument: 'after',
      runValidators: true, // для оновлень валідатори схеми за замовчуванням вимкнені
    });
    if (film === null) {
      throw this.notFound(id);
    }
    return FilmDto.fromDocument(film);
  }

  async remove(id: string): Promise<void> {
    if ((await this.filmModel.exists({ _id: id })) === null) {
      throw this.notFound(id);
    }
    // Зовнішніх ключів у MongoDB немає: залежні сеанси перевіряємо запитом
    if (await this.showingsCore.hasShowingsForFilm(id)) {
      this.logger.warn(
        `Відмова видалити фільм ${id}: на нього посилаються сеанси`,
      );
      throw new ConflictException(
        'Фільм не можна видалити: на нього посилається хоча б один сеанс',
      );
    }
    await this.filmModel.deleteOne({ _id: id });
  }

  private notFound(id: string): NotFoundException {
    this.logger.warn(`Фільм з id ${id} не знайдено`);
    return new NotFoundException(`Фільм з id ${id} не знайдено`);
  }
}
