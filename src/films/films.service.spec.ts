import { ConflictException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { ShowingsCoreService } from '../showings/showings-core.service.js';
import { FilmsService } from './films.service.js';
import { Film } from './schemas/film.schema.js';

const filmId = new Types.ObjectId();
const film = {
  _id: filmId,
  title: 'Земля',
  durationMinutes: 75,
  releaseYear: 1930,
  __v: 0,
};

describe('FilmsService', () => {
  let service: FilmsService;
  const showingsCore = { hasShowingsForFilm: vi.fn() };
  const filmModel = {
    exists: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    deleteOne: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    filmModel.exists.mockResolvedValue({ _id: filmId });

    const moduleRef = await Test.createTestingModule({
      providers: [
        FilmsService,
        { provide: getModelToken(Film.name), useValue: filmModel },
        { provide: ShowingsCoreService, useValue: showingsCore },
      ],
    }).compile();

    service = moduleRef.get(FilmsService);
  });

  it('видаляє фільм без сеансів', async () => {
    showingsCore.hasShowingsForFilm.mockResolvedValue(false);

    await service.remove(filmId.toString());

    expect(showingsCore.hasShowingsForFilm).toHaveBeenCalledWith(
      filmId.toString(),
    );
    expect(filmModel.deleteOne).toHaveBeenCalledWith({
      _id: filmId.toString(),
    });
  });

  it('повертає 409 і не видаляє, якщо на фільм посилається сеанс', async () => {
    showingsCore.hasShowingsForFilm.mockResolvedValue(true);

    await expect(service.remove(filmId.toString())).rejects.toThrow(
      ConflictException,
    );
    expect(filmModel.deleteOne).not.toHaveBeenCalled();
  });

  it('не перевіряє сеанси, якщо фільму немає', async () => {
    filmModel.exists.mockResolvedValue(null);

    await expect(service.remove(filmId.toString())).rejects.toThrow(
      NotFoundException,
    );
    expect(showingsCore.hasShowingsForFilm).not.toHaveBeenCalled();
  });

  it('оновлює з валідаторами схеми й віддає рядковий id без службових полів', async () => {
    filmModel.findByIdAndUpdate.mockResolvedValue({ ...film, title: 'Нова' });

    const updated = await service.update(filmId.toString(), { title: 'Нова' });

    expect(filmModel.findByIdAndUpdate).toHaveBeenCalledWith(
      filmId.toString(),
      { title: 'Нова' },
      { returnDocument: 'after', runValidators: true },
    );
    expect(updated).toEqual({
      id: filmId.toString(),
      title: 'Нова',
      durationMinutes: 75,
      releaseYear: 1930,
    });
  });

  it('повертає 404 на оновлення неіснуючого фільму', async () => {
    filmModel.findByIdAndUpdate.mockResolvedValue(null);

    await expect(
      service.update(filmId.toString(), { title: 'Нема' }),
    ).rejects.toThrow(NotFoundException);
  });
});
