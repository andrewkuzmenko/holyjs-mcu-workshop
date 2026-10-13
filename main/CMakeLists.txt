idf_component_register(SRCS "beshell-step.cpp"
                    INCLUDE_DIRS "."
                    REQUIRES become-cool__beshell)

# mklittlefs from the beshell component (downloaded by Component Manager on first build)
set(BESHELL_TOOLS "${CMAKE_CURRENT_SOURCE_DIR}/../managed_components/become-cool__beshell/tools")
if(CMAKE_HOST_WIN32)
    set(MKLITTLEFS "${BESHELL_TOOLS}/mklittlefs.exe")
elseif(CMAKE_HOST_APPLE)
    set(MKLITTLEFS "${BESHELL_TOOLS}/mklittlefs-darwin")
else()
    set(MKLITTLEFS "${BESHELL_TOOLS}/mklittlefs")
endif()
# Component Manager unpacks the tool without the execute bit — restore it.
if(EXISTS "${MKLITTLEFS}")
    file(CHMOD "${MKLITTLEFS}" PERMISSIONS
        OWNER_READ OWNER_WRITE OWNER_EXECUTE
        GROUP_READ GROUP_EXECUTE
        WORLD_READ WORLD_EXECUTE)
endif()
set(JS_IMAGE "${CMAKE_BINARY_DIR}/js.bin")
set(JS_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../js")

add_custom_command(
    OUTPUT "${JS_IMAGE}"
    COMMAND "${MKLITTLEFS}" -c "${JS_DIR}" -p 4096 -b 4096 -s 1048576 "${JS_IMAGE}"
    DEPENDS "${JS_DIR}/main.js" "${JS_DIR}/stepper.js" "${JS_DIR}/notes.js"
    VERBATIM
)

add_custom_target(js_bin ALL DEPENDS "${JS_IMAGE}")

set(JS_ADDRESS 0x110000)
partition_table_get_partition_info(JS_OFFSET "--partition-name js" "offset")
if(JS_OFFSET)
    set(JS_ADDRESS ${JS_OFFSET})
endif()

esptool_py_flash_to_partition(flash "js" "${JS_IMAGE}")
