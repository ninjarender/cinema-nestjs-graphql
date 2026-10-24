import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ShowingsCoreService } from '../showings/showings-core.service.js';
import { CreateFilmInput } from './dto/create-film.input.js';
import { UpdateFilmInput } from './dto/update-film.input.js';
import { Film, FilmDocument } from './schemas/film.schema.js';

@Injectable()
export class FilmsService {
  private readonly logger = new Logger(FilmsService.name);

  constructor(
    @InjectModel(Film.name)
    private readonly filmModel: Model<Film>,
    private readonly showingsCore: ShowingsCoreService,
  ) {}

  async create(input: CreateFilmInput): Promise<FilmDocument> {
    return this.filmModel.create(input);
  }

  async findAll(): Promise<FilmDocument[]> {
    return this.filmModel.find().sort({ _id: 1 });
  }

  /** Фільм або null: query film повертає null для неіснуючого id, а не помилку. */
  async findById(id: string): Promise<FilmDocument | null> {
    return this.filmModel.findById(id);
  }

  async update(id: string, input: UpdateFilmInput): Promise<FilmDocument> {
    const film = await this.filmModel.findByIdAndUpdate(id, input, {
      returnDocument: 'after',
      runValidators: true, // для оновлень валідатори схеми за замовчуванням вимкнені
    });
    if (film === null) {
      throw this.notFound(id);
    }
    return film;
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
