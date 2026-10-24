import { ApiProperty } from '@nestjs/swagger';
import type { Types } from 'mongoose';
import { OBJECT_ID_EXAMPLE } from '../../common/decorators/api-object-id-param.decorator.js';

/** Сеанс після populate('film', 'title') і populate('hall', 'name'). */
export interface PopulatedShowing {
  _id: Types.ObjectId;
  film: { title: string };
  hall: { name: string };
  startsAt: Date;
  price: number;
}

/** Сеанс у відповідях на читання: назви фільму й залу, без seats і bookings. */
export class ShowingView {
  @ApiProperty({ example: OBJECT_ID_EXAMPLE, description: 'ObjectId' })
  id: string;

  @ApiProperty({ example: 'Тіні забутих предків' })
  filmTitle: string;

  @ApiProperty({ example: 'Зал 1' })
  hallName: string;

  @ApiProperty({ example: '2026-11-20T18:30:00.000Z' })
  startsAt: Date;

  @ApiProperty({ example: 12500, description: 'Ціна квитка в копійках' })
  price: number;

  static fromDocument(showing: PopulatedShowing): ShowingView {
    const view = new ShowingView();
    view.id = showing._id.toString();
    view.filmTitle = showing.film.title;
    view.hallName = showing.hall.name;
    view.startsAt = showing.startsAt;
    view.price = showing.price;
    return view;
  }
}
