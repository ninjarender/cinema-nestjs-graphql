import { ApiProperty } from '@nestjs/swagger';
import { listHallSeats } from '../hall-seats.js';
import type { HallDocument } from '../schemas/hall.schema.js';
import { HallDto } from './hall.dto.js';

export class SeatPosition {
  @ApiProperty({ example: 1 })
  row: number;

  @ApiProperty({ example: 4 })
  seat: number;
}

/** Перелік місць не зберігається в БД — обчислюється з rows × seatsPerRow. */
export class HallWithSeats extends HallDto {
  @ApiProperty({
    type: [SeatPosition],
    description: 'Усі місця залу, rows × seatsPerRow',
  })
  seats: SeatPosition[];

  static fromDocument(hall: HallDocument): HallWithSeats {
    const dto = Object.assign(new HallWithSeats(), HallDto.fromDocument(hall));
    dto.seats = listHallSeats(hall);
    return dto;
  }
}
