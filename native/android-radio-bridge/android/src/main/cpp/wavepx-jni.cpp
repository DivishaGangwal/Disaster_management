#include <jni.h>
#include <algorithm>
#include <cstdint>
#include <vector>

#include "ggwave/ggwave.h"

namespace {

ggwave_Instance createDecoder(float sampleRate, ggwave_SampleFormat format) {
  auto parameters = ggwave_getDefaultParameters();
  parameters.payloadLength = -1;
  parameters.sampleRateInp = sampleRate;
  parameters.sampleRate = 48000.0f;
  parameters.sampleFormatInp = format;
  parameters.operatingMode = GGWAVE_OPERATING_MODE_RX;
  return ggwave_init(parameters);
}

jbyteArray toJavaBytes(JNIEnv * env, const std::uint8_t * bytes, int count) {
  if (count <= 0) return nullptr;
  auto output = env->NewByteArray(count);
  if (output == nullptr) return nullptr;
  env->SetByteArrayRegion(output, 0, count, reinterpret_cast<const jbyte *>(bytes));
  return output;
}

} // namespace

extern "C" JNIEXPORT jint JNICALL
Java_com_dsm_radio_WavePxNative_createI16Decoder(JNIEnv *, jobject, jint sampleRate) {
  return createDecoder(static_cast<float>(sampleRate), GGWAVE_SAMPLE_FORMAT_I16);
}

extern "C" JNIEXPORT jint JNICALL
Java_com_dsm_radio_WavePxNative_createF32Decoder(JNIEnv *, jobject, jint sampleRate) {
  return createDecoder(static_cast<float>(sampleRate), GGWAVE_SAMPLE_FORMAT_F32);
}

extern "C" JNIEXPORT jbyteArray JNICALL
Java_com_dsm_radio_WavePxNative_decodeI16(JNIEnv * env, jobject, jint instance, jshortArray samples, jint count) {
  if (instance < 0 || samples == nullptr || count <= 0) return nullptr;
  const auto available = env->GetArrayLength(samples);
  const auto bounded = std::min(count, available);
  std::vector<jshort> input(static_cast<std::size_t>(bounded));
  env->GetShortArrayRegion(samples, 0, bounded, input.data());
  std::uint8_t payload[GGWave::kMaxDataSize] = {};
  const int decoded = ggwave_ndecode(instance, input.data(), bounded * sizeof(jshort), payload, sizeof(payload));
  return toJavaBytes(env, payload, decoded);
}

extern "C" JNIEXPORT jbyteArray JNICALL
Java_com_dsm_radio_WavePxNative_decodeF32(JNIEnv * env, jobject, jint instance, jbyteArray pcm) {
  if (instance < 0 || pcm == nullptr) return nullptr;
  const auto size = env->GetArrayLength(pcm);
  std::vector<jbyte> input(static_cast<std::size_t>(size));
  env->GetByteArrayRegion(pcm, 0, size, input.data());
  std::uint8_t payload[GGWave::kMaxDataSize] = {};
  const int decoded = ggwave_ndecode(instance, input.data(), size, payload, sizeof(payload));
  return toJavaBytes(env, payload, decoded);
}

extern "C" JNIEXPORT void JNICALL
Java_com_dsm_radio_WavePxNative_destroyDecoder(JNIEnv *, jobject, jint instance) {
  if (instance >= 0) ggwave_free(instance);
}
