import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiObjectIdParam } from '../common/decorators/api-object-id-param.decorator.js';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe.js';
import { CreateHallDto } from './dto/create-hall.dto.js';
import { HallWithSeats } from './dto/hall-with-seats.dto.js';
import { HallDto } from './dto/hall.dto.js';
import { HallsService } from './halls.service.js';

@ApiTags('halls')
@Controller('halls')
export class HallsController {
  constructor(private readonly hallsService: HallsService) {}

  @Post()
  @ApiCreatedResponse({ type: HallDto })
  @ApiBadRequestResponse({
    description:
      'Поле відсутнє, має неправильний тип або число не є цілим додатним',
  })
  @ApiConflictResponse({ description: 'Зал з такою назвою вже існує' })
  async create(@Body() dto: CreateHallDto): Promise<HallDto> {
    return this.hallsService.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: [HallDto] })
  async findAll(): Promise<HallDto[]> {
    return this.hallsService.findAll();
  }

  @Get(':id')
  @ApiObjectIdParam('Id залу')
  @ApiOkResponse({ type: HallWithSeats })
  @ApiNotFoundResponse({ description: 'Зал не знайдено' })
  async findOne(
    @Param('id', ParseObjectIdPipe) id: string,
  ): Promise<HallWithSeats> {
    return this.hallsService.findOneWithSeats(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiObjectIdParam('Id залу')
  @ApiNoContentResponse({ description: 'Зал видалено' })
  @ApiNotFoundResponse({ description: 'Зал не знайдено' })
  @ApiConflictResponse({ description: 'На зал посилається хоча б один сеанс' })
  async remove(@Param('id', ParseObjectIdPipe) id: string): Promise<void> {
    await this.hallsService.remove(id);
  }
}
