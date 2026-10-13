#include <stdio.h>
#include <beshell/BeShell.hpp>
#include <beshell/basic/Console.hpp>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

using namespace std;
using namespace be;

/** Копируем вывод JS в консоль ESP. */
static void console_to_stdout(const char * data, size_t len)
{
    fwrite(data, 1, len, stdout);
    fflush(stdout);
}

static void beshell_task(void *pvParameters)
{
    Console::writeHandler = console_to_stdout;
    // Это не настоящий канал REPL → console.log пропускает двоичные output() и
    // только обращается к writeHandler (чистый текст в консоли USB).
    Console::setChannel("stdout");

    BeShell beshell;
    beshell.use<FS>();
    FS::mount("/", new LittleFS("js", true));
    beshell.main("/main.js");
}

extern "C" void app_main(void)
{
    xTaskCreatePinnedToCore(beshell_task, "beshell_task", 1024 * 48, NULL, 1, NULL, 1);
}
