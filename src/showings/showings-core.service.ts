import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Showing, ShowingDocument } from './schemas/showing.schema.js';

/**
 * Доступ до сеансів, потрібний іншим модулям.
 *
 * Його імпортують і модуль сеансів, і модулі фільмів та залів (перевірка перед
 * видаленням), і модуль бронювань. Так зустрічна залежність films ↔ showings
 * не виникає: спільна частина винесена в окремий сервісний модуль (тема 4).
 */
@Injectable()
export class ShowingsCoreService {
  private readonly logger = new Logger(ShowingsCoreService.name);

  constructor(
    @InjectModel(Showing.name)
    private readonly showingModel: Model<Showing>,
  ) {}

  /** Сеанс лише з потрібними полями (projection) або 404. */
  async findOne(id: string, projection: string): Promise<ShowingDocument> {
    const showing = await this.showingModel.findById(id, projection);
    if (showing === null) {
      throw this.notFound(id);
    }
    return showing;
  }

  async hasShowingsForFilm(filmId: string): Promise<boolean> {
    return (await this.showingModel.exists({ film: filmId })) !== null;
  }

  async hasShowingsForHall(hallId: string): Promise<boolean> {
    return (await this.showingModel.exists({ hall: hallId })) !== null;
  }

  notFound(id: string): NotFoundException {
    this.logger.warn(`Сеанс з id ${id} не знайдено`);
    return new NotFoundException(`Сеанс з id ${id} не знайдено`);
  }
}
