# mcu-js-holy-workshop

Демо к мастер-классу HolyJS **«JS, микроконтроллеры и ИИ: MCP выходит в реальный мир»**.

JavaScript (BeShell / QuickJS) на ESP32-S3 играет мелодии на шаговом моторе, а ИИ-агент управляет им по MCP. Репозиторий устроен как лестница тегов: каждый тег — один уровень мастер-класса, каждый следующий наращивает предыдущий.

| Tag | Что добавляется | Проверка |
|-----|-----------------|----------|
| `hello` | BeShell на ESP32-S3, `console.log` в serial | строка `hello from ESP32-S3` в мониторе |
| `stepper-tone` | класс `Stepper`, одна нота A4 на моторе | мотор гудит 5 секунд |
| `melody` | `playSequence`, гамма до-мажор вверх и вниз | гамма при старте |
| `wifi-sta` | подключение к Wi‑Fi (STA) | IP платы в мониторе |
| `http` | HTTP-сервер, `GET /health` | `curl http://<IP>/health` |
| `mcp` | MCP-сервер на `POST /mcp`, 4 tools | агент в Cursor играет мелодии |

Ветка `master` = тег `mcp` (финальное состояние).

---

## Что понадобится

**Железо**

- Плата **ESP32-S3** с **16 MB flash** и **8 MB Octal PSRAM** — например ESP32-S3-DevKitC-1 **N16R8**. С другими модулями (меньше flash, без PSRAM или с Quad PSRAM) прошивка в таком виде не загрузится, см. [типовые ошибки](#типовые-ошибки).
- USB-кабель с данными (не только зарядка). Подключать в разъём **USB** (не UART), если на плате их два.
- Для уровней со звуком (`stepper-tone` и дальше): шаговый мотор NEMA17, драйвер A4988 или DRV8825 на плате-переходнике, блок питания 12 В для мотора, провода. Без мотора всё остальное тоже работает — просто без звука.

**Софт**

- git
- **ESP-IDF 5.5.x** (установка ниже). Python ставится вместе с ним.
- Любой редактор кода.
- Для финала: Cursor или другой MCP-клиент с поддержкой Streamable HTTP.

---

## 1. Установить ESP-IDF 5.5

Официальная инструкция: <https://docs.espressif.com/projects/esp-idf/en/v5.5/esp32s3/get-started/index.html>. Ниже — короткий путь.

### macOS

```bash
brew install cmake ninja dfu-util python3
mkdir -p ~/esp && cd ~/esp
git clone -b v5.5 --recursive https://github.com/espressif/esp-idf.git
cd esp-idf && ./install.sh esp32s3
```

Перед каждой сессией в терминале:

```bash
. ~/esp/esp-idf/export.sh
```

### Linux (Debian / Ubuntu)

```bash
sudo apt-get install git wget flex bison gperf python3 python3-pip python3-venv cmake ninja-build ccache libffi-dev libssl-dev dfu-util libusb-1.0-0
mkdir -p ~/esp && cd ~/esp
git clone -b v5.5 --recursive https://github.com/espressif/esp-idf.git
cd esp-idf && ./install.sh esp32s3
```

Доступ к USB-порту без `sudo`:

```bash
sudo usermod -aG dialout $USER   # затем перелогиниться
```

Перед каждой сессией: `. ~/esp/esp-idf/export.sh`

### Windows

1. Скачать **ESP-IDF Windows Installer**: <https://dl.espressif.com/dl/esp-idf/>
2. В установщике выбрать версию **v5.5** и чип **ESP32-S3**.
3. Работать из ярлыка **«ESP-IDF 5.5 PowerShell»** — он сам выполняет `export`.

### Проверка

```bash
idf.py --version      # ESP-IDF v5.5.x
```

---

## 2. Склонировать репозиторий с тегами

```bash
git clone https://github.com/andrewkuzmenko/holyjs-mcu-workshop.git mcu-js-holy-workshop
cd mcu-js-holy-workshop
git fetch --tags --force
git tag                # hello  stepper-tone  melody  wifi-sta  http  mcp
```

`--force` нужен, если вы клонировали раньше: некоторые теги переносились.

Переключение между уровнями:

```bash
git checkout hello     # или любой другой тег
```

---

## 3. Первая сборка и прошивка (тег `hello`)

```bash
git checkout hello
idf.py set-target esp32s3     # один раз; создаёт sdkconfig из sdkconfig.defaults
idf.py build                  # первый раз долго: качает компоненты и собирает IDF
idf.py -p PORT flash
idf.py -p PORT monitor
```

`PORT` — порт платы:

| ОС | Как выглядит | Как найти |
|----|--------------|-----------|
| macOS | `/dev/cu.usbmodem*` | `ls /dev/cu.*` |
| Linux | `/dev/ttyACM0` | `ls /dev/ttyACM*` |
| Windows | `COM5` | Диспетчер устройств → Порты |

Если порт один, `-p PORT` можно не указывать — `idf.py` найдёт его сам.

В мониторе после загрузки: таблица разделов, объём PSRAM, частота CPU (160 МГц), логотип BeShell и `hello from ESP32-S3`.

**Выход из монитора — `Ctrl+]`.** Это надо сделать перед следующей прошивкой: пока монитор открыт, порт занят.

Команды можно объединять: `idf.py build flash monitor`.

### Если `idf.py build` падает на `mklittlefs: Permission denied`

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

### Поменять строку и перепрошить

Откройте `js/main.js`, замените текст в `console.log`, затем `idf.py build flash monitor`. Пересборка быстрая: native-часть не менялась.

---

## 4. Как устроен проект

```
main/beshell-step.cpp   точка входа (C++): запускает BeShell на втором ядре, монтирует FS, стартует /main.js
main/idf_component.yml  зависимости ESP-IDF — аналог package.json
main/CMakeLists.txt     собирает js/ в образ LittleFS (build/js.bin)
js/                     весь JavaScript; на плате это раздел js, корень /
partitions.csv          разделы flash: factory 3 MB (прошивка), js 1 MB (скрипты)
sdkconfig.defaults      16 MB flash, Octal PSRAM, буферы Wi‑Fi
```

JS-файлы по тегам (на `mcp` — все):

| Файл | За что отвечает |
|------|-----------------|
| `main.js` | пины, Wi‑Fi, сборка HTTP + MCP |
| `stepper.js` | `Stepper`: импульсы на STEP с частотой ноты, последовательности |
| `notes.js` | имя ноты → частота в Гц, A0…C8 |
| `http.js` | `HttpServer` — роутер над `mg.listenHttp` |
| `mcp.js` | `McpServer` — JSON-RPC на `/mcp`, `/health` |
| `tools.js` | `ToolRegistry` + 4 tools для мотора |

---

## 5. Два вида прошивки

**Полная** — когда менялось что-то кроме `js/` (C++, `idf_component.yml`): теги `wifi-sta` и `http`.

```bash
idf.py build flash
```

**Только JS** — когда менялись только файлы в `js/`: теги `stepper-tone`, `melody`, `mcp`. Native-часть не трогаем, заливаем один раздел:

```bash
idf.py build
esptool.py --chip esp32s3 -p PORT write_flash 0x310000 build/js.bin
```

После заливки плата перезагружается сама; если нет — кнопка **RESET** на плате.

---

## 6. Стенд с мотором (`stepper-tone` и дальше)

| Сигнал | GPIO | Куда на драйвере |
|--------|------|------------------|
| EN | **4** | ENABLE (активный низкий: `0` = мотор включён) |
| STEP | **5** | STEP |
| DIR | **6** | DIR (в коде зафиксирован, мотор крутится в одну сторону) |
| GND | GND | GND логики драйвера |

Питание мотора (12 В) — на драйвер отдельно, **не от платы**. Логика драйвера — от 3.3 В платы. Пины можно поменять в `js/main.js` (`PIN_EN`, `PIN_STEP`, `PIN_DIR`).

Как это звучит: на STEP подаются импульсы с частотой ноты, драйвер на каждый импульс делает шаг, мотор дёргается с частотой ноты — и её слышно.

---

## 7. Wi‑Fi (`wifi-sta` и дальше)

В `js/main.js`:

```js
const STA_SSID = 'YOUR_SSID'
const STA_PWD = 'YOUR_PASSWORD'
```

- Сеть **2.4 ГГц** — ESP32-S3 не видит 5 ГГц. Hotspot телефона подходит, если в нём включён диапазон 2.4.
- Ноутбук с агентом должен быть **в той же сети**, что и плата.
- IP платы появится в мониторе: `WiFi connected, IP: 192.168.x.x`.

Это полная прошивка: `idf.py build flash`.

---

## 8. HTTP и MCP (`http`, `mcp`)

На `http` появляется зависимость `beshell-mg`. Перед сборкой:

```bash
idf.py update-dependencies   # скачает компонент в managed_components/
idf.py build flash
```

Проверка:

```bash
curl http://<IP>/health
# {"ok":true,"server":{...},"stepper":{...}}        — на http
# {"ok":true,"mcp":"/mcp","server":{...},...}       — на mcp
```

На `mcp` в мониторе появится `MCP URL: http://<IP>/mcp`. Дальше — подключение агента, curl-команды для `tools/list` и `tools/call`, готовые промпты: **[docs/PARTICIPANT.md](docs/PARTICIPANT.md)**.

Без платы первый уровень можно повторить в браузере: **[docs/WOKWI.md](docs/WOKWI.md)**.

---

## Типовые ошибки

| Симптом | Причина | Что делать |
|---------|---------|------------|
| `idf.py: command not found` | не выполнен `export.sh` в этом терминале | `. ~/esp/esp-idf/export.sh` (Windows: открыть «ESP-IDF 5.5 PowerShell») |
| `A fatal error occurred: Could not open port` / `Port busy` | порт занят монитором или другой программой | закрыть монитор (`Ctrl+]`), закрыть другие терминалы с портом |
| `mklittlefs-darwin: Permission denied`, `FAILED: [code=126] js.bin` | у скачанной утилиты нет бита исполнения | `chmod +x managed_components/become-cool__beshell/tools/mklittlefs*`, затем `idf.py build`; macOS при Gatekeeper — `xattr -d com.apple.quarantine …/mklittlefs-darwin` |
| `Permission denied: '/dev/ttyACM0'` (Linux) | нет прав на порт | `sudo usermod -aG dialout $USER`, перелогиниться |
| `Failed to connect to ESP32-S3: No serial data received` | плата не вошла в режим прошивки | зажать **BOOT**, нажать **RESET**, отпустить BOOT, повторить `flash` |
| `SPI SRAM memory test fail` / зацикленная перезагрузка после старта | модуль без Octal PSRAM | нужна плата N16R8; с другой — менять `sdkconfig.defaults` (это уже вне мастер-класса) |
| Перезагрузка сразу после `cpu_start: Multicore app` (`rst:0x10 (RTCWDT_RTC_RST)`), без `memory test` и без текста ошибки | модуль с флеш Macronix (`esptool.py flash_id` → `Manufacturer: c2`): в режиме DIO при Octal PSRAM чтение из флеш портится, [esp-idf #18806](https://github.com/espressif/esp-idf/issues/18806) | в `sdkconfig.defaults` уже стоит `CONFIG_ESPTOOLPY_FLASHMODE_QIO=y`; если `sdkconfig` создан раньше — удалить его и собрать заново (дефолты применяются только при создании), в логе должно быть `SPI Mode : QIO` |
| `Failed to connect to "YOUR_SSID"` | креды-плейсхолдеры, сеть 5 ГГц или далеко | вписать SSID/пароль в `js/main.js`, 2.4 ГГц, ближе к точке |
| Wi‑Fi подключился, но `curl` не отвечает | ноутбук в другой сети / изолированные клиенты в гостевом Wi‑Fi | та же сеть; дома — обычный роутер или hotspot телефона |
| `Component "become-cool/beshell-mg" not found` | зависимости не скачаны | `idf.py update-dependencies` |
| Сборка ругается на target или старый кэш после переключения тега | `build/` от другой конфигурации | `idf.py fullclean && idf.py set-target esp32s3 && idf.py build` |
| `ESP-IDF v5.x` другая мажорная версия | не та ветка IDF | нужен `v5.5`; проверка `idf.py --version` |
| Монитор показывает мусор вместо текста | неверная скорость порта | `idf.py monitor` сам ставит 115200; в сторонних терминалах выставить вручную |

---

Компоненты: [BeShell](https://github.com/become-cool/beshell) и [beshell-mg](https://components.espressif.com/components/become-cool/beshell-mg) от become-cool; внутри beshell-mg — [Mongoose](https://mongoose.ws/).
