package com.dsm.radio

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Process
import androidx.core.content.ContextCompat
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread
import kotlin.math.max

internal object WavePxNative {
  init { System.loadLibrary("dsm_wavepx") }
  external fun createI16Decoder(sampleRate: Int): Int
  external fun createF32Decoder(sampleRate: Int): Int
  external fun decodeI16(instance: Int, samples: ShortArray, count: Int): ByteArray?
  external fun decodeF32(instance: Int, pcm: ByteArray): ByteArray?
  external fun destroyDecoder(instance: Int)
}

/**
 * Android audio backend for WavePX. WavePX is the Tier 2 application layer;
 * its ggwave physical modem is compiled natively so AudioRecord PCM never has
 * to cross the React Native bridge.
 */
internal class WavePxAudioReceiver(
  private val context: Context,
  private val onFrame: (ByteArray, Long) -> Unit,
  private val onStopped: (String, Long) -> Unit,
  private val onError: (String, String, Long) -> Unit,
) {
  companion object { const val SAMPLE_RATE = 48_000 }

  private val running = AtomicBoolean(false)
  private var recorder: AudioRecord? = null
  private var captureThread: Thread? = null
  private var decoder = -1

  @SuppressLint("MissingPermission")
  @Synchronized fun start(timeoutMs: Long) {
    if (running.get()) return
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
      throw SecurityException("Microphone permission is required for WavePX listening")
    }
    val minimumBytes = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
    if (minimumBytes <= 0) throw IllegalStateException("This device cannot capture 48 kHz mono PCM for WavePX")
    val bufferBytes = max(minimumBytes, 8_192)
    var nextRecorder = try {
      makeRecorder(MediaRecorder.AudioSource.UNPROCESSED, bufferBytes)
    } catch (_: Throwable) {
      makeRecorder(MediaRecorder.AudioSource.MIC, bufferBytes)
    }
    if (nextRecorder.state != AudioRecord.STATE_INITIALIZED) {
      nextRecorder.release()
      nextRecorder = makeRecorder(MediaRecorder.AudioSource.MIC, bufferBytes)
    }
    if (nextRecorder.state != AudioRecord.STATE_INITIALIZED) {
      nextRecorder.release()
      throw IllegalStateException("WavePX AudioRecord initialization failed")
    }
    val nextDecoder = WavePxNative.createI16Decoder(SAMPLE_RATE)
    if (nextDecoder < 0) {
      nextRecorder.release()
      throw IllegalStateException("WavePX physical modem initialization failed")
    }
    recorder = nextRecorder
    decoder = nextDecoder
    running.set(true)
    nextRecorder.startRecording()
    val startedAt = System.currentTimeMillis()
    captureThread = thread(name = "dsm-wavepx-listener", isDaemon = true) {
      Process.setThreadPriority(Process.THREAD_PRIORITY_AUDIO)
      val samples = ShortArray(bufferBytes / 2)
      var stopReason = "stopped"
      try {
        while (running.get()) {
          if (System.currentTimeMillis() - startedAt >= timeoutMs) { stopReason = "timed-out"; break }
          val count = nextRecorder.read(samples, 0, samples.size, AudioRecord.READ_BLOCKING)
          if (count < 0) throw IllegalStateException("AudioRecord read failed: $count")
          val frame = WavePxNative.decodeI16(nextDecoder, samples, count)
          if (frame != null && frame.isNotEmpty()) onFrame(frame, System.currentTimeMillis())
        }
      } catch (reason: Throwable) {
        stopReason = "error"
        onError("WAVEPX_AUDIO_CAPTURE", reason.message ?: "WavePX audio capture failed", System.currentTimeMillis())
      } finally {
        releaseFromCaptureThread(nextRecorder, nextDecoder)
        onStopped(stopReason, System.currentTimeMillis())
      }
    }
  }

  @SuppressLint("MissingPermission")
  private fun makeRecorder(source: Int, bufferBytes: Int) = AudioRecord(
    source,
    SAMPLE_RATE,
    AudioFormat.CHANNEL_IN_MONO,
    AudioFormat.ENCODING_PCM_16BIT,
    bufferBytes,
  )

  @Synchronized fun stop() {
    running.set(false)
    try { recorder?.stop() } catch (_: Throwable) {}
  }

  private fun releaseFromCaptureThread(activeRecorder: AudioRecord, activeDecoder: Int) {
    running.set(false)
    try { activeRecorder.stop() } catch (_: Throwable) {}
    activeRecorder.release()
    WavePxNative.destroyDecoder(activeDecoder)
    synchronized(this) {
      if (recorder === activeRecorder) recorder = null
      if (decoder == activeDecoder) decoder = -1
      captureThread = null
    }
  }
}
