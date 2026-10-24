import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { Showing } from '../showings/schemas/showing.schema.js';
import { ShowingsCoreService } from '../showings/showings-core.service.js';
import { BookingsService } from './bookings.service.js';

const showingId = new Types.ObjectId();
const hall = { name: 'Зал 1', rows: 3, seatsPerRow: 5 };
const showing = { _id: showingId, price: 12500, hall };

describe('BookingsService', () => {
  let service: BookingsService;

  // Замінники залежностей: модульний тест перевіряє лише BookingsService
  const showingsCore = { findOne: vi.fn() };
  const showingModel = { updateOne: vi.fn(), findById: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    showingsCore.findOne.mockResolvedValue({
      populate: vi.fn().mockResolvedValue(showing),
    });
    showingModel.updateOne.mockResolvedValue({
      matchedCount: 1,
      modifiedCount: 1,
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: getModelToken(Showing.name), useValue: showingModel },
        { provide: ShowingsCoreService, useValue: showingsCore },
      ],
    }).compile();

    service = moduleRef.get(BookingsService);
  });

  it('бронює одним updateOne: $elemMatch на кожне місце, arrayFilters + $push', async () => {
    const seats = [
      { row: 1, seat: 2 },
      { row: 1, seat: 1 },
    ];
    const booking = await service.create(showingId.toString(), { seats });

    expect(showingModel.updateOne).toHaveBeenCalledTimes(1);
    const [filter, update, options] = showingModel.updateOne.mock.calls[0];
    const bookingId = update.$push.bookings._id as Types.ObjectId;

    expect(filter).toEqual({
      _id: showingId,
      $and: seats.map(({ row, seat }) => ({
        seats: { $elemMatch: { row, seat, bookingId: null } },
      })),
    });
    expect(update.$set).toEqual({ 'seats.$[target].bookingId': bookingId });
    expect(update.$push.bookings).toMatchObject({ seats, totalPrice: 25000 });
    expect(options).toEqual({
      arrayFilters: [
        {
          $or: seats.map(({ row, seat }) => ({
            'target.row': row,
            'target.seat': seat,
          })),
        },
      ],
    });
    expect(booking).toMatchObject({
      id: bookingId.toString(),
      showingId: showingId.toString(),
      totalPrice: 25000,
      seats: [
        { row: 1, seat: 1 },
        { row: 1, seat: 2 },
      ],
    });
  });

  it('matchedCount === 0 → 409 з переліком зайнятих місць', async () => {
    showingModel.updateOne.mockResolvedValue({
      matchedCount: 0,
      modifiedCount: 0,
    });
    showingModel.findById.mockResolvedValue({
      seats: [
        { row: 1, seat: 5, bookingId: new Types.ObjectId() },
        { row: 2, seat: 1, bookingId: null },
      ],
    });

    const error = await service
      .create(showingId.toString(), {
        seats: [
          { row: 2, seat: 1 },
          { row: 1, seat: 5 },
        ],
      })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).message).toBe(
      'Місця вже заброньовані на цьому сеансі: ряд 1 місце 5',
    );
  });

  it('конфлікт визначає matchedCount, а не modifiedCount', async () => {
    showingModel.updateOne.mockResolvedValue({
      matchedCount: 1,
      modifiedCount: 0,
    });

    await expect(
      service.create(showingId.toString(), { seats: [{ row: 1, seat: 1 }] }),
    ).resolves.toMatchObject({ totalPrice: 12500 });
  });

  it('відхиляє місце поза межами залу ДО оновлення', async () => {
    await expect(
      service.create(showingId.toString(), { seats: [{ row: 4, seat: 1 }] }),
    ).rejects.toThrow(BadRequestException);
    expect(showingModel.updateOne).not.toHaveBeenCalled();
  });

  it('передає далі 404, якщо сеансу немає', async () => {
    showingsCore.findOne.mockRejectedValue(new NotFoundException());

    await expect(
      service.create(showingId.toString(), { seats: [{ row: 1, seat: 1 }] }),
    ).rejects.toThrow(NotFoundException);
    expect(showingModel.updateOne).not.toHaveBeenCalled();
  });

  it('скасовує одним оновленням: $set звільняє місця, $pull прибирає запис', async () => {
    const bookingId = new Types.ObjectId();

    await service.remove(bookingId.toString());

    expect(showingModel.updateOne).toHaveBeenCalledWith(
      { 'bookings._id': bookingId },
      {
        $set: { 'seats.$[target].bookingId': null },
        $pull: { bookings: { _id: bookingId } },
      },
      { arrayFilters: [{ 'target.bookingId': bookingId }] },
    );
  });

  it('повертає 404 на скасування неіснуючого бронювання', async () => {
    showingModel.updateOne.mockResolvedValue({
      matchedCount: 0,
      modifiedCount: 0,
    });

    await expect(
      service.remove(new Types.ObjectId().toString()),
    ).rejects.toThrow(NotFoundException);
  });
});
