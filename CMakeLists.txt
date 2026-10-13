# The following five lines of boilerplate have to be in your project's
# CMakeLists in this exact order for cmake to work correctly
cmake_minimum_required(VERSION 3.16)

set(PARTITION_TABLE_CSV "${CMAKE_CURRENT_SOURCE_DIR}/partitions.csv")
set(IDF_TARGET esp32s3)

include($ENV{IDF_PATH}/tools/cmake/project.cmake)
project(beshell-step)
