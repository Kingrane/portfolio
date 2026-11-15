# Публикация v3

## Версия и резервная копия

- Прежний `main`: `07a6a34bc59034aff28ca9135396c7bbbf6a3bac`.
- Резервная ветка `mainbackup` создана от него и запушена на origin.
- `redesign` с `020d33f` запушен без пользовательских briefs/references.
- `main` получил merge-коммит `dfb9c7a` от `020d33f`; следующие затемнение hero и усиление левых цветов в эту публикацию не включены.
- В `.github/workflows/deploy.yml` добавлен `id: deployment`, чтобы `environment.url` ссылался на существующий шаг.

## Реально выполнено

Изолированная рабочая копия: `C:\Users\REDMI\AppData\Local\Temp\opencode\portfolio-main-publish`. У неё собственные `node_modules`, `.next` и `out`; основной проект не пересобирался.

```powershell
npm ci --no-audit --no-fund
npm run build
```

- Windows, Node.js 24.14.0, npm 11.16.0, Next.js 16.2.9.
- Установка: успешно, 424 пакета.
- Production build: exit 0; компиляция 6.7 с, встроенный TypeScript 7.6 с, генерация 4/4 статических страниц.
- Маршруты `/` и `/_not-found` статические; `output: export`, production prefix `/portfolio`.
- [Вывод сборки](v3-publication-build.txt).

GitHub Actions отдельно использует Node.js 20 и выполняет собственные `npm ci`/`npm run build`. Успех локальной сборки не равен успеху деплоя; состояние workflow подтверждается после push.

Lint, отдельный tsc/QA, браузер, новые скриншоты, FPS/Lighthouse/CLS и компиляция GLSL в runtime **не проверялись**. Это разрешённая сборка публикации, не полный QA новых визуалов.
