# Cinema GraphQL API (MongoDB)

GraphQL API кінотеатру на NestJS: фільми, зали, сеанси й бронювання місць.
Це той самий сервіс, що й у ДЗ_3 на **MongoDB** (Mongoose): дані, бізнес-правила й механізм бронювання не змінилися.
Змінився лише шар доступу. Замість REST-маршрутів працює **одна адреса GraphQL**, і клієнт сам обирає потрібні поля.
REST-контролери та Swagger видалено.

## Запуск

Потрібні Node.js 20.12+ і Docker.

```bash
# 1. Встановити залежності
npm install

# 2. Створити файл оточення з прикладу і заповнити (див. нижче)
cp .env.example .env

# 3. Підняти MongoDB через Docker Compose
docker compose up -d

# 4. (необов'язково) Засіяти БД тестовими даними
npm run seed

# 5. Запустити в режимі розробки
npm run start:dev
```

### GraphQL-ендпоінт

**`http://localhost:3000/graphql`** (порт задає `PORT`). Усі операції йдуть `POST`-запитом на цю адресу.
Якщо відкрити її в браузері, з'явиться GraphiQL: редактор запитів з автодоповненням за схемою.
Поза режимом `NODE_ENV=production` він увімкнений за замовчуванням.

Міграцій немає: структуру документів задають схеми Mongoose, колекції й індекси створюються під час першого запису.
Якщо `MONGODB_URI` відсутня або не схожа на рядок підключення MongoDB, застосунок **не стартує** (валідація `EnvironmentVariables`).

### Приклад `.env`

Один файл використовують і застосунок, і Docker Compose (підставляє `${...}` у `docker-compose.yml`).

```env
# Порт HTTP-сервера (необов'язковий, за замовчуванням 3000)
PORT=3000

# Docker Compose: порт на машині та кореневий користувач MongoDB (створюється лише на першому старті з порожнім томом)
MONGO_PORT=27017
MONGO_ROOT_USER=cinema
MONGO_ROOT_PASSWORD=cinema

# Рядок підключення застосунку: cinema — робоча база, authSource=admin — база, де створено кореневого користувача
MONGODB_URI=mongodb://cinema:cinema@localhost:27017/cinema?authSource=admin

# (необов'язково) true — Mongoose пише в консоль кожен запит до бази; за замовчуванням false
MONGOOSE_DEBUG=false
```

Якщо змінити `MONGO_ROOT_*` після першого запуску, користувача не буде перестворено. Тоді потрібен `docker compose down -v`.

### Docker Compose

```bash
docker compose up -d      # підняти MongoDB у фоні
docker compose ps         # сервіс mongodb має статус Up
docker compose down       # зупинити; дані лишаються в volume cinema-mongo-data
docker compose down -v    # зупинити й видалити дані
```

Образ закріплено як `mongo:8.2`. Образи 8.3+ не стартують на ядрах Linux 6.19 і новіших
([SERVER-121912](https://jira.mongodb.org/browse/SERVER-121912)).

### Seed

```bash
npm run seed
```

Дані генерує [`@faker-js/faker`](https://fakerjs.dev/): 4 фільми, 2 зали, 8 сеансів (кожен у свою добу, починаючи із завтра)
і 3 бронювання на вільні місця. Кількість задають константи на початку `src/seed.ts`.

Скрипт піднімає контекст NestJS без HTTP-сервера. Підключення й валідація `.env` ті самі, що в застосунку, а записи йдуть через моделі Mongoose.
Повторний запуск нічого не дублює. Faker працює з фіксованим `seed`, тож кожен запуск дає ті самі документи з тими самими `_id`,
а запис іде upsert-ом за `_id` з `$setOnInsert`, тому наявні документи не змінюються. Версія faker у `package.json` закріплена точно,
бо інша версія з тим самим `seed` генерує інші дані.

## Приклад: сторінка сеансів з назвами фільмів

```graphql
query ShowingsPage($filmId: ID, $date: String, $page: Int, $limit: Int, $sort: SortOrder) {
  showings(filmId: $filmId, date: $date, page: $page, limit: $limit, sort: $sort) {
    total
    page
    limit
    items {
      id
      startsAt
      price
      film { title durationMinutes }
      hall { name }
    }
  }
}
```

```json
{ "page": 1, "limit": 5, "sort": "ASC" }
```

Те саме з терміналу:

```bash
curl -s http://localhost:3000/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ showings(limit: 2) { total page limit items { id startsAt price film { title } hall { name } } } }"}'
```

Відповідь на засіяних даних (`limit: 2`):

```json
{
  "data": {
    "showings": {
      "total": 8,
      "page": 1,
      "limit": 2,
      "items": [
        {
          "id": "9d487ac03fabe6bdc8ded4c5",
          "startsAt": "2026-10-25T19:00:00.000Z",
          "price": 21900,
          "film": { "title": "To Kill a Mockingbird" },
          "hall": { "name": "Зал «Миколаїв»" }
        },
        {
          "id": "cddd4a4819d33c0eb9a42c27",
          "startsAt": "2026-10-26T19:00:00.000Z",
          "price": 14500,
          "film": { "title": "The Way We Live Now" },
          "hall": { "name": "Зал «Павлоград»" }
        }
      ]
    }
  }
}
```

Інші приклади:

```graphql
# Місця сеансу з ознакою зайнятості та його бронювання
query Showing($id: ID!) {
  showing(id: $id) {
    film { title }
    seats { row seat isBooked }
    bookings { id totalPrice seats { row seat } }
  }
}

# Бронювання: усі місця одним оновленням або CONFLICT
mutation Book($showingId: ID!) {
  createBooking(showingId: $showingId, seats: [{ row: 1, seat: 4 }, { row: 1, seat: 5 }]) {
    id
    showingId
    totalPrice
    createdAt
  }
}
```

## Схема (code-first)

Схему не пишемо вручну. Класи з декораторами `@ObjectType`/`@Field`, `@InputType`, `@ArgsType` описують типи,
і NestJS при старті генерує з них SDL у файл **[`src/schema.gql`](src/schema.gql)**. Шлях задано в конфігурації:
`GraphQLModule.forRoot<ApolloDriverConfig>({ driver: ApolloDriver, autoSchemaFile: join(process.cwd(), 'src/schema.gql'), sortSchema: true })`.
Файл закомічено, тож схему видно без запуску. Після зміни типів він перегенеровується під час `npm run start:dev` або `npm run test:e2e`.

- **Об'єктні типи — ті самі класи, що й схеми Mongoose** (`Film`, `Hall`, `Showing`, `Seat`, `BookedSeat`): на одному класі
  стоять `@Schema`/`@Prop` і `@ObjectType`/`@Field`, як `@ApiProperty` раніше.
  `_id` віддається полем `id` рядком: `@Field(() => ID, { name: 'id' }) _id: Types.ObjectId`.
- **Обов'язковість відповідає моделі.** Поля без `nullable` дають `!`. `nullable: true` стоїть лише там, де значення справді може бути відсутнім:
  `film`/`hall`/`showing` (повертають `null` для неіснуючого id), аргументи `showings` і поля `UpdateFilmInput`.
- **Поля, яких немає в документі в потрібній формі, обчислюють резолвери полів (`@ResolveField`):**
  - `Showing.film`, `Showing.hall`: у документі це `ObjectId`, а клієнт отримує об'єкт;
  - `Seat.isBooked`: у документі зберігається `bookingId` (`null` — вільне);
  - `Showing.bookings`: вкладене бронювання не містить id свого сеансу, тож резолвер у модулі бронювань додає `showingId`.
    Тип `Booking` — це клас `BookingView`, що успадковує поля абстрактного GraphQL-класу схеми `Booking`.
- `Hall` не має поля `seats`, бо зайнятість має сенс лише в межах сеансу (`Showing.seats`).
- Аргументи `showings` описує клас `ShowingsArgs` з `@ArgsType` (`@Args() args: ShowingsArgs`), а не окремі скаляри.
  Так само зроблено `createBooking(showingId, seats)`: клас `CreateBookingArgs` дає ті самі два аргументи, і class-validator перевіряє масив.
- `enum SortOrder { ASC, DESC }` зареєстровано через `registerEnumType`. У коді значення — `'asc'`/`'desc'`, які приймає `sort()` Mongoose.
- `DateTime` — власний скаляр (`common/scalars/date-time.scalar.ts`, `@Scalar('DateTime', () => Date)`) для полів типу `Date`.
  Вбудований у `@nestjs/graphql` робить `new Date(value)` з будь-чого (`"12/25/2030"`, число мілісекунд), тож його замінено:
  приймається лише рядок ISO 8601, як у DTO ДЗ_3, інакше `BAD_USER_INPUT`. У відповідях — ISO 8601 в UTC. Ціни — `Int`, у копійках.

## Як розв'язано N+1: `populate` у запиті списку

Резолвер поля `Showing.film` викликається на кожен сеанс. Якби він ходив у базу, сторінка з 20 сеансів дала б 1 + 20 + 20 запитів.

Обрано **`populate` у сервісі** (`ShowingsService.findAll`):

```ts
this.showingModel
  .find(filter)
  .sort({ startsAt: sort, _id: 'asc' })
  .skip((page - 1) * limit)
  .limit(limit)
  .populate(['film', 'hall']);
```

Mongoose збирає `film` і `hall` усіх сеансів сторінки й робить **по одному запиту `$in`** до `films` і `halls`.
Резолвери полів `film`/`hall` лише повертають уже підставлені документи й до бази не звертаються.
Сторінка будь-якого розміру — це завжди 4 запити: `showings.find`, `showings.countDocuments`, `films.find`, `halls.find`.
`showing(id)` так само робить `populate`. `createShowing` підставляє фільм і зал, які вже прочитав для перевірки існування, без повторного запиту.

**Чому `populate`, а не DataLoader:**

- зв'язків лише два (`film`, `hall`), і обидва — посилання на інші колекції, а `populate` — штатний механізм Mongoose саме для цього (тема 8);
- `GraphQLModule.forRoot` лишається статичним: DataLoader треба створювати **на кожен запит** (через `context`),
  щоб кеш не ділився між клієнтами, а це окремий фабричний провайдер або request-scoped сервіси;
- ціна відома: `populate` виконується, навіть якщо клієнт не запитував `film`/`hall`. На сторінці до 100 сеансів це
  два легкі запити за `_id`. Якби зв'язків було багато або їх рідко запитували, DataLoader був би кращим вибором.

**Перевірка.** `MONGOOSE_DEBUG=true` у `.env` вмикає лог Mongoose (`connection.set('debug', true)`). На запит сторінки сеансів
з `film { title } hall { name }` у консолі видно рівно один `films.find({ _id: { $in: [...] } })` і один `halls.find(...)`:

```
Mongoose: showings.find({}, { sort: { startsAt: 1, _id: 1 }, skip: 0, limit: 2 })
Mongoose: showings.countDocuments({}, {})
Mongoose: films.find({ _id: { '$in': [ ObjectId("e685f1bf5f3e3fb2b6c245fc"), ObjectId("fdb7e2caeec57ed4cabd7baf") ] }}, {})
Mongoose: halls.find({ _id: { '$in': [ ObjectId("50a8803dbbb426bc4cef9833"), ObjectId("c6c5ef2cb1d9938e945ec5e1") ] }}, {})
```

Те саме перевіряє e2e-тест `resolves film and hall of a page without a query per showing (N+1)`:
він підключає функцію до того самого debug-логу й рахує запити за колекціями.

## Помилки

GraphQL відповідає HTTP 200 і кладе помилку в масив `errors`. Клієнт розрізняє випадки за **`errors[0].extensions.code`**:

```json
{
  "errors": [
    {
      "message": "Місця вже заброньовані на цьому сеансі: ряд 1 місце 5",
      "path": ["createBooking"],
      "extensions": { "code": "CONFLICT" }
    }
  ],
  "data": null
}
```

| Ситуація | Результат |
|---|---|
| `film` / `hall` / `showing` з неіснуючим id | `null` без помилки |
| мутація над неіснуючим документом; `createShowing` з неіснуючим фільмом/залом; `createBooking` на неіснуючий сеанс | `NOT_FOUND` |
| порушення валідації вхідних даних (class-validator) | `BAD_USER_INPUT` |
| id не у форматі ObjectId | `BAD_USER_INPUT` (до звернення до бази) |
| `startsAt` у минулому, `price` не ціле додатне, місце поза залом, повтор місця, порожній масив місць | `BAD_USER_INPUT` |
| зайняте місце при бронюванні (не бронюється жодне) | `CONFLICT` |
| видалення фільму/залу, на який посилаються сеанси | `CONFLICT` |
| зал з наявною назвою (без урахування регістру) | `CONFLICT` |
| помилка бази даних чи інший збій | `INTERNAL_SERVER_ERROR` з текстом `Internal server error`, деталі лише в логах сервера |
| синтаксис запиту, неіснуюче поле, неправильний тип змінної | помилки самого GraphQL: `GRAPHQL_PARSE_FAILED`, `GRAPHQL_VALIDATION_FAILED`, `BAD_USER_INPUT` |

Як це влаштовано:

- **Сервіси не змінилися.** Як і в REST-версії, вони кидають винятки Nest: `NotFoundException`, `ConflictException`, `BadRequestException`.
  Єдина зміна стосується `createShowing`: неіснуючий фільм чи зал тепер дає `NotFoundException`, як вимагає ДЗ, а не `400`.
- **`GraphqlExceptionFilter`** (`APP_FILTER`, замість HTTP-фільтра з REST-версії) перетворює винятки на `GraphQLError` з кодом:
  400 → `BAD_USER_INPUT`, 404 → `NOT_FOUND`, 409 → `CONFLICT` (401/403 → `UNAUTHENTICATED`/`FORBIDDEN`, інші 4xx → `BAD_REQUEST`).
  Будь-яку іншу помилку він пише в лог зі стеком,
  а клієнт отримує `INTERNAL_SERVER_ERROR` без деталей. Стандартне перетворення Nest тут не годиться:
  404 і 409 воно віддало б як `INTERNAL_SERVER_ERROR`, а 400 — як `BAD_REQUEST`.
  Фільтр глобальний, тому звичайні HTTP-запити поза GraphQL (`GET /` → 404, битий JSON у тілі → 400) він передає
  стандартному обробнику Nest (`BaseExceptionFilter`), і ті отримують звичайну HTTP-відповідь.
- **`formatError`** (`formatGraphqlError`) — друга межа. Фільтри Nest не діють на резолвери полів (`@ResolveField`) і на помилки
  виконання самого GraphQL, наприклад `null` у полі з `!`. Усе, що дійшло до відповіді з кодом `INTERNAL_SERVER_ERROR`,
  отримує загальний текст, а оригінал іде в лог. `includeStacktraceInErrorResponses: false` прибирає стек з відповіді.

## Валідація

- Вхідні типи (`CreateFilmInput`, `UpdateFilmInput`, `CreateHallInput`, `CreateShowingInput`, `SeatInput`) і класи аргументів
  (`ShowingsArgs`, `CreateBookingArgs`) перевіряє **class-validator**. Правила перенесено з DTO ДЗ_3 без змін.
- `ValidationPipe` зареєстрований глобально (`APP_PIPE` в `AppModule`) і діє на `@Args()` резолверів так само, як на `@Body()` контролерів.
  - ⚠️ Pipes діють і на `@Parent()` резолверів полів, тому батьківський об'єкт типізовано аліасом типу (`PopulatedShowing`, `ShowingDocument`),
    а не класом. З класом у метаданих `ValidationPipe` спробував би перетворити документ Mongoose.
- **Формат id** перевіряється **до звернення до бази**, бо скаляр `ID` приймає будь-який рядок. Для аргументів `id`
  це робить `ParseObjectIdPipe` (`@Args('id', { type: () => ID }, ParseObjectIdPipe)`), для `filmId`/`hallId`/`showingId` у вхідних типах — `@IsMongoId`.
  Без цього Mongoose кинув би `CastError`.
- **Унікальність пар `row`/`seat`** перевіряє `@ArrayUnique` у `CreateBookingArgs` до звернення до бази.
- `UpdateFilmInput` = `PartialType(CreateFilmInput, { skipNullProperties: false })` з `@nestjs/graphql`. Пропущене поле не змінюється,
  а явний `null` перевіряється тими самими правилами й дає `BAD_USER_INPUT`, до бази він не доходить.
- Аргументи `page`/`limit`/`sort` мають значення за замовчуванням у схемі (`1`, `20`, `ASC`). Явний `null` у будь-якому аргументі `showings`
  (зокрема `filmId`, `date`) трактується так само, як пропущений аргумент.

## Чому місця й бронювання зберігаються всередині документа сеансу

Модель даних не змінилася з ДЗ_3. Колекцій три: `films`, `halls`, `showings`. Документ сеансу містить масив своїх місць `seats`
і масив своїх бронювань `bookings`.

```js
{
  _id: ObjectId('…'),
  film: ObjectId('…'),            // посилання на films → populate('film')
  hall: ObjectId('…'),            // посилання на halls → populate('hall')
  startsAt: ISODate('2026-11-20T18:30:00Z'),
  price: 12500,                   // копійки
  seats: [                        // розгортаються з rows × seatsPerRow під час createShowing
    { row: 1, seat: 1, bookingId: null },              // null — вільне
    { row: 1, seat: 4, bookingId: ObjectId('b1') },    // зайняте бронюванням b1
    …
  ],
  bookings: [
    { _id: ObjectId('b1'), seats: [{ row: 1, seat: 4 }], totalPrice: 12500, createdAt: ISODate('…') },
  ],
}
```

- **Бронювання — одним оновленням документа сеансу.** `createBooking` робить один `updateOne`. Умова вимагає, щоб **кожне** місце було вільним
  (`$elemMatch` з `bookingId: null` на кожне місце). Оновлення ставить `bookingId` через `arrayFilters` і додає запис через `$push`.
  Якщо хоч одне місце зайняте, документ не змінюється, а `matchedCount === 0` перетворюється на `CONFLICT`.
  Оновлення одного документа в MongoDB неподільне, тож транзакція не потрібна. Два одночасні запити на одне місце виконуються послідовно,
  і другий отримує `CONFLICT`. Це перевіряє e2e-тест.
- **Межі залу — до оновлення.** Фільтр оновлення не відрізнив би неіснуюче місце від зайнятого, і місце поза залом дало б `CONFLICT` замість `BAD_USER_INPUT`.
- **Скасування** (`cancelBooking`). Id бронювання не містить посилання на сеанс, тому сеанс шукається за вкладеним елементом (`'bookings._id'`, є індекс).
  Одне оновлення звільняє місця (`$set` з `arrayFilters`) і прибирає запис (`$pull`).
- **Межа застосовності.** Місць у залі кілька сотень, а бронювань на сеанс не більше, ніж місць, тож документ лишається далеко від ліміту MongoDB в 16 МБ.

## Перевірка

- GraphiQL на `http://localhost:3000/graphql` або будь-який GraphQL-клієнт (Apollo Sandbox, Postman, Insomnia).
- `npm test` — unit-тести сервісів (моделі замінені моками).
- `npm run test:e2e` — e2e-тести всіх запитів і мутацій через `POST /graphql` на окремій базі `<база з MONGODB_URI>_test`
  (підміну робить `test/setup-e2e.ts` до імпорту `AppModule`, а тест зупиняється, якщо підключився не до `*_test`).
  Вони перевіряють коди помилок, пагінацію, атомарність бронювання, кількість запитів до бази (N+1) і приховування деталей помилок БД.
  Потрібен запущений `docker compose`.
- `npm run lint` — oxlint.

## Структура

```
src/
├── films/        фільми: схема = GraphQL-тип, input-типи, сервіс, FilmsResolver
├── halls/        зали й обчислення переліку місць, HallsResolver
├── showings/     сеанси: ShowingsArgs, ShowingPage, ShowingsResolver (film/hall — @ResolveField), SeatsResolver (isBooked)
├── bookings/     бронювання одним оновленням документа сеансу; BookingsResolver, ShowingBookingsResolver (Showing.bookings)
├── common/       GraphqlExceptionFilter, formatError, ParseObjectIdPipe
├── config/       валідація змінних оточення
├── schema.gql    згенерована схема GraphQL
└── seed.ts       засівання БД
```

- Кожен домен — окремий модуль. Резолвери зареєстровані **провайдерами своїх модулів** поруч із сервісами.
  Резолвер приймає операцію й викликає сервіс, бізнес-логіка лишилася в сервісах.
- Доступ до сеансів для інших модулів винесено в сервісний модуль без резолверів — `ShowingsCoreModule`.
  Його імпортують `films` і `halls` (перевірка сеансів перед видаленням) і `bookings`. Так зустрічної залежності `films ↔ showings` немає.
- Підключення до БД — `MongooseModule.forRootAsync` з рядком із `ConfigService` (не `process.env`).
- Сервіси пишуть попередження через вбудований `Logger` (не знайдено, конфлікт), фільтр — підсумок `поле -> код`.
