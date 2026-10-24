import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { isDuplicateKeyError } from '../common/database-errors.js';
import { ShowingsCoreService } from '../showings/showings-core.service.js';
import { CreateHallInput } from './dto/create-hall.input.js';
import { CASE_INSENSITIVE, Hall, HallDocument } from './schemas/hall.schema.js';

@Injectable()
export class HallsService {
  private readonly logger = new Logger(HallsService.name);

  constructor(
    @InjectModel(Hall.name)
    private readonly hallModel: Model<Hall>,
    private readonly showingsCore: ShowingsCoreService,
  ) {}

  async create(input: CreateHallInput): Promise<HallDocument> {
    // Та сама колація, що в унікальному індексі: зрозумілий CONFLICT без спроби запису
    const nameTaken = await this.hallModel
      .exists({ name: input.name })
      .collation(CASE_INSENSITIVE);
    if (nameTaken !== null) {
      throw this.nameConflict(input.name);
    }

    try {
      return await this.hallModel.create(input);
    } catch (error) {
      // Два одночасні запити з тією самою назвою (у будь-якому регістрі): другий відхилить unique-індекс
      if (isDuplicateKeyError(error)) {
        throw this.nameConflict(input.name);
      }
      throw error;
    }
  }

  async findAll(): Promise<HallDocument[]> {
    return this.hallModel.find().sort({ _id: 1 });
  }

  /** Зал або null: query hall повертає null для неіснуючого id, а не помилку. */
  async findById(id: string): Promise<HallDocument | null> {
    return this.hallModel.findById(id);
  }

  async remove(id: string): Promise<void> {
    if ((await this.hallModel.exists({ _id: id })) === null) {
      throw this.notFound(id);
    }
    // Зовнішніх ключів у MongoDB немає: залежні сеанси перевіряємо запитом
    if (await this.showingsCore.hasShowingsForHall(id)) {
      this.logger.warn(
        `Відмова видалити зал ${id}: на нього посилаються сеанси`,
      );
      throw new ConflictException(
        'Зал не можна видалити: на нього посилається хоча б один сеанс',
      );
    }
    await this.hallModel.deleteOne({ _id: id });
  }

  private notFound(id: string): NotFoundException {
    this.logger.warn(`Зал з id ${id} не знайдено`);
    return new NotFoundException(`Зал з id ${id} не знайдено`);
  }

  private nameConflict(name: string): ConflictException {
    this.logger.warn(`Відмова створити зал: назва "${name}" зайнята`);
    return new ConflictException(`Зал з назвою "${name}" вже існує`);
  }
}
