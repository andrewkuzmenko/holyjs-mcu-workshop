# mcu-js-holy-workshop

Демо для мастер-класса HolyJS:  
**«JS, микроконтроллеры и ИИ: MCP выходит в реальный мир»**

Тег **`wifi-sta`**: всё из `melody` **плюс** подключение к существующей Wi‑Fi сети (STA), IP в консоль. Впиши `STA_SSID` / `STA_PWD` в `js/main.js` перед прошивкой.

| | |
|---|---|
| Chip | ESP32-S3, **16MB flash**, **Octal PSRAM** |
| IDF | **5.5.x** |
| Target | `esp32s3` |
| JS | LittleFS `js` → `/main.js` |
| Stepper | EN **4** · STEP **5** · DIR **6** |
| Wi‑Fi | STA · SSID/PWD в `js/main.js` · IP в serial |

Предыдущие: `hello` · `stepper-tone` · `melody`.

---

## Быстрый старт

```bash
git clone -b wifi-sta https://github.com/andrewkuzmenko/holyjs-mcu-workshop.git mcu-js-holy-workshop
cd mcu-js-holy-workshop

. $IDF_PATH/export.sh
idf.py set-target esp32s3
idf.py build
idf.py flash monitor
```

В мониторе: гамма C-dur, затем примерно:

```text
Connecting to WiFi "YOUR_SSID"...
WiFi connected, IP: 192.168.x.x
(no HTTP yet — same melody, now on your network)
```

С `melody` → `wifi-sta` нужна **полная** прошивка: в C++ добавлен `beshell.use<WiFi>()`.

---

## Что добавилось на этом теге

- C++: `beshell.use<WiFi>()`
- JS: `import * as wifi from 'wifi'` + `wifi.connect` / `wifi.waitIP`

Пока **нет** HTTP/`/health` (тег `http`) и MCP (тег `mcp`).

---

## Теги

| Tag | Содержимое |
|-----|------------|
| `hello` | `console.log` |
| `stepper-tone` | одна нота A4 |
| `melody` | C-dur up/down |
| `wifi-sta` | melody + Wi‑Fi STA |
| `http` | + HTTP `/health` (следующий) |
| `mcp` | HTTP + MCP tools |

## Как залить на MCU только JS

- `idf.py build`
- `esptool.py --chip esp32s3 -p PORT write_flash 0x310000 build/js.bin`

После прошивки — reset или `idf.py -p PORT monitor`.
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
