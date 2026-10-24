import type { SeatPosition } from './dto/hall-with-seats.dto.js';

interface HallSize {
  rows: number;
  seatsPerRow: number;
}

/** Перелік місць залу: ряди й місця нумеруються з 1. */
export function listHallSeats({ rows, seatsPerRow }: HallSize): SeatPosition[] {
  const seats: SeatPosition[] = [];
  for (let row = 1; row <= rows; row++) {
    for (let seat = 1; seat <= seatsPerRow; seat++) {
      seats.push({ row, seat });
    }
  }
  return seats;
}

export function hallHasSeat(
  { rows, seatsPerRow }: HallSize,
  { row, seat }: SeatPosition,
): boolean {
  return row >= 1 && row <= rows && seat >= 1 && seat <= seatsPerRow;
}
