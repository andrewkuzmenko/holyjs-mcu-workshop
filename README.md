# mcu-js-holy-workshop

Демо для мастер-класса HolyJS:  
**«JS, микроконтроллеры и ИИ: MCP выходит в реальный мир»**

Текущий тег **`stepper-tone`**: BeShell + класс `Stepper`, одна нота **A4** на **5 с**, затем silence.

| | |
|---|---|
| Chip | ESP32-S3, **16MB flash**, **Octal PSRAM** |
| IDF | **5.5.x** |
| Target | `esp32s3` |
| JS | LittleFS partition `js` → `/main.js` |
| Stepper | EN **4** · STEP **5** · DIR **6** (PWM tone, DIR fixed CW) |

Предыдущие: `hello`. Далее: `melody` → `wifi-sta` → `http` → `mcp`.

---

## Требования

- Плата ESP32-S3 с **16MB flash** и **Octal PSRAM** (см. `sdkconfig.defaults`)
- Драйвер шаговика (STEP/DIR/EN) на пинах выше
- [ESP-IDF 5.5](https://docs.espressif.com/projects/esp-idf/en/v5.5.2/esp32s3/get-started/index.html)

---

## Быстрый старт

```bash
git clone -b stepper-tone https://github.com/andrewkuzmenko/holyjs-mcu-workshop.git mcu-js-holy-workshop
cd mcu-js-holy-workshop

. $IDF_PATH/export.sh

idf.py set-target esp32s3
idf.py build
idf.py flash monitor
```

В мониторе:

```text
Stepper ready; playing A4 for 5000 ms
```

и ~5 с тона на моторе, затем silence.

(`console.log` → stdout через `Console::writeHandler` в `main/beshell-step.cpp`.)

Выход из monitor: `Ctrl+]`.

`managed_components/`, `build/`, `sdkconfig` появятся при первой сборке (в git не коммитятся).

---

## Обновить только JS на плате

Если C++ не менялся:

```bash
. $IDF_PATH/export.sh
idf.py build
parttool.py --port PORT write_partition --partition-name=js --input build/js.bin
```

Эквивалент через `esptool` (offset `0x310000` для текущего `partitions.csv`):

```bash
idf.py build
esptool.py --chip esp32s3 -p PORT write_flash 0x310000 build/js.bin
```

---

## Что в репозитории

```text
js/main.js              — пины + new Stepper → init → playNote('A4', 5000)
js/stepper.js           — class Stepper (tone; playSequence — тег melody)
js/notes.js             — целые Гц A0–C8 для LEDC
main/beshell-step.cpp   — BeShell + console mirror
main/idf_component.yml  — become-cool/beshell
```

Частота ноты задаётся через stock BeShell `gpio.pwm.config` (отдельного `setFreq` нет).

```javascript
import { Stepper } from '/stepper.js'

const PIN_EN = 4
const PIN_STEP = 5
const PIN_DIR = 6

const motor = new Stepper({ en: PIN_EN, step: PIN_STEP, dir: PIN_DIR })
motor.init()
motor.playNote('A4', 5000)
```

`durationMs`: `null`/`undefined` — играет до `stop()`; иначе clamp в **1..5000** мс.

---

## Теги мастер-класса

| Tag | Содержимое |
|-----|------------|
| `hello` | `console.log` |
| `stepper-tone` | одна нота A4 5 с |
| `melody` | C-dur up/down |
| `wifi-sta` | melody + Wi‑Fi STA |
| `http` | + HTTP `/health` |
| `mcp` | HTTP + MCP tools |

Далее: `melody` → `wifi-sta` → `http` → `mcp`.

## Если `idf.py build` падает на `mklittlefs: Permission denied`

Это нормально при первой сборке: менеджер компонентов скачивает `beshell` без бита исполнения на утилите, которая собирает образ JS. Выставить права и повторить:

```bash
chmod +x managed_components/become-cool__beshell/tools/mklittlefs*
idf.py build
```

macOS, если после `chmod` всё равно не запускается (Gatekeeper):

```bash
xattr -d com.apple.quarantine managed_components/become-cool__beshell/tools/mklittlefs-darwin
```

На Windows не возникает (`mklittlefs.exe`).

---

## Без платы

Уровень `hello` можно повторить в браузере: [docs/WOKWI.md](docs/WOKWI.md) (готовый UF2, без облачной сборки).
