cmake_minimum_required(VERSION 3.20)

project(yobble_launcher LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(yobble_launcher
  src/main.cpp
)

target_compile_definitions(yobble_launcher PRIVATE UNICODE _UNICODE)

if (WIN32)
  target_link_libraries(yobble_launcher PRIVATE Ws2_32)
endif()
