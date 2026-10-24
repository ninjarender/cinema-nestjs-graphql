import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { CreateFilmDto } from './dto/create-film.dto.js';
import { FilmDto } from './dto/film.dto.js';
import { UpdateFilmDto } from './dto/update-film.dto.js';
import { FilmsService } from './films.service.js';

@ApiTags('films')
@Controller('films')
export class FilmsController {
  constructor(private readonly filmsService: FilmsService) {}

  @Post()
  @ApiCreatedResponse({ type: FilmDto })
  @ApiBadRequestResponse({
    description: 'Поле відсутнє або має неправильний тип',
  })
  async create(@Body() dto: CreateFilmDto): Promise<FilmDto> {
    return this.filmsService.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: [FilmDto] })
  async findAll(): Promise<FilmDto[]> {
    return this.filmsService.findAll();
  }

  @Get(':id')
  @ApiObjectIdParam('Id фільму')
  @ApiOkResponse({ type: FilmDto })
  @ApiNotFoundResponse({ description: 'Фільм не знайдено' })
  async findOne(@Param('id', ParseObjectIdPipe) id: string): Promise<FilmDto> {
    return this.filmsService.findOne(id);
  }

  @Patch(':id')
  @ApiObjectIdParam('Id фільму', 'Неправильний тип поля або id не є ObjectId')
  @ApiOkResponse({ type: FilmDto })
  @ApiNotFoundResponse({ description: 'Фільм не знайдено' })
  async update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateFilmDto,
  ): Promise<FilmDto> {
    return this.filmsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiObjectIdParam('Id фільму')
  @ApiNoContentResponse({ description: 'Фільм видалено' })
  @ApiNotFoundResponse({ description: 'Фільм не знайдено' })
  @ApiConflictResponse({
    description: 'На фільм посилається хоча б один сеанс',
  })
  async remove(@Param('id', ParseObjectIdPipe) id: string): Promise<void> {
    await this.filmsService.remove(id);
  }
}
