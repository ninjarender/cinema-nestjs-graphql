import { existsSync } from 'node:fs';

// e2e працює з окремою базою <db>_test, щоб не чіпати дані розробки.
//
// ⚠️ Підміна — у setupFiles, а не у верхній частині spec-файла: імпорти виконуються раніше
// за код модуля, і ConfigModule.forRoot() у декораторі AppModule прочитав би .env ще під час
// `import { AppModule }`, тобто з робочою базою. ConfigModule не перезаписує змінні, які вже є в process.env.
if (existsSync('.env')) {
  process.loadEnvFile(); // у CI змінні можуть прийти з оточення без файла
}
const uri = new URL(process.env.MONGODB_URI!);
uri.pathname = `${uri.pathname.length > 1 ? uri.pathname : '/cinema'}_test`;
process.env.MONGODB_URI = uri.toString();
