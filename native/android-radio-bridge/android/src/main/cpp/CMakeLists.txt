cmake_minimum_required(VERSION 3.22.1)
project(dsm_wavepx LANGUAGES CXX)

add_library(dsm_wavepx SHARED
  wavepx-jni.cpp
  vendor/ggwave/src/ggwave.cpp
)

target_include_directories(dsm_wavepx PRIVATE vendor/ggwave/include)
target_compile_features(dsm_wavepx PRIVATE cxx_std_11)
target_compile_options(dsm_wavepx PRIVATE -O3 -fvisibility=hidden)
target_link_libraries(dsm_wavepx android log)
