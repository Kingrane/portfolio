# v3 / A — архив до запрета новых проверок

## Почему ASCII был почти невиден в v2

Слабая ambient-маска дополнительно перемножалась с низкой яркостью сцены. Кривая выбора плотности на тёмных лепестках почти всегда выбирала пробел или точку. Поэтому сам пост-проход работал, но итоговые цветные глифы почти исчезали. Диагностический `?ascii=full` позволил отделить эту причину от проблем вывода.

В A добавлены perceptual density, gain 1.5 и glow 0.12, CSS-ячейки 10/11 px, Bayer 8×8, восемь источников и точная геометрическая защита сердцевин. Звёзды отделены от входа плотности. Исправлено залипание touch-источника.

## Что доказывает архив

Кадры сняты **до** продолжения B–D и до запрета дальнейших тестов. Они относятся к ASCII-ядру, зафиксированному в `208dd32`; на них старые оранжевая дыра и плотный сад. Основные BEFORE/AFTER-кадры были просмотрены во время фазы A. Эти изображения нельзя выдавать за проверку новой палитры, бенто, бабочек или нынешней раскладки сада.

| Кадр | BEFORE | AFTER |
|---|---|---|
| Hero, desktop, полный ASCII | [до](before/full-desktop-dpr1-hero.png) | [после](after/full-desktop-dpr1-hero.png) |
| Сад, desktop, полный ASCII | [до](before/full-desktop-dpr1-garden.png) | [после](after/full-desktop-dpr1-garden.png) |
| Hero, mobile, полный ASCII | [до](before/full-mobile-dpr1-hero.png) | [после](after/full-mobile-dpr1-hero.png) |
| Сад, mobile, полный ASCII | [до](before/full-mobile-dpr1-garden.png) | [после](after/full-mobile-dpr1-garden.png) |

- Ambient: [hero desktop](after/ambient-desktop-dpr1-hero.png), [сад desktop](after/ambient-desktop-dpr1-garden.png), [hero mobile](after/ambient-mobile-dpr1-hero.png), [сад mobile](after/ambient-mobile-dpr1-garden.png).
- `?tune`: [desktop](after/tune-desktop-panel.png), [mobile](after/tune-mobile-panel.png).
- Дополнительные canvas-only и DPR=2 снимки лежат в `before/` и `after/`.
- [Финальный ASCII JSON](after/ascii-qa.json), [effects](effects.json), [fallback smoke](smoke.json).

Полный QA A зафиксировал 55/55 checkpoints, 22/22 снимка, ноль ошибок геометрии/контраста/runtime и ноль предполагаемых швов. Это **старый автоматический результат**, не гарантия отсутствия всех визуальных дефектов. FPS, Lighthouse и CLS не измерялись.

Сохранены и неудачные ранние JSON, включая transient 404 сразу после пересборки. Финальный повторный прогон A завершился без этих ошибок. Новые прогоны после `208dd32` не запускались.

Этот архив содержит диагностические BEFORE/AFTER и сводки, а не весь покадровый захват. Полный исходный пакет с 22 общими снимками, контрастными фонами и seam-кадрами сохранён по адресу `C:\Users\REDMI\AppData\Local\Temp\opencode\portfolio-qa-v3-a`. Пути в исходных JSON относятся к тому пакету.

Нынешний статус находится в [v3-status.md](../v3-status.md).
