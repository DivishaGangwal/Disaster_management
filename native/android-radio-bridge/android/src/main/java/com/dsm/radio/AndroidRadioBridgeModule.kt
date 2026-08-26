package com.dsm.radio

import android.Manifest
import android.annotation.SuppressLint
import android.app.ActivityManager
import android.bluetooth.*
import android.bluetooth.le.*
import android.content.Context
import android.content.BroadcastReceiver
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.BatteryManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.util.Base64
import androidx.core.content.ContextCompat
import androidx.core.os.bundleOf
import expo.modules.interfaces.permissions.Permissions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.io.DataInputStream
import java.io.DataOutputStream
import java.security.MessageDigest
import java.util.ArrayDeque

class AndroidRadioBridgeModule : Module() {
  private val context: Context get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()
  private val manager: BluetoothManager? get() = context.getSystemService(BluetoothManager::class.java)
  private val adapter: BluetoothAdapter? get() = manager?.adapter
  private val peerDevices = ConcurrentHashMap<String, BluetoothDevice>()
  private val addressTokens = ConcurrentHashMap<String, String>()
  private val clientGatts = ConcurrentHashMap<String, BluetoothGatt>()
  private val sessionPeers = ConcurrentHashMap<String, String>()
  private val serverDevices = ConcurrentHashMap<String, BluetoothDevice>()
  private val pendingSessions = ConcurrentHashMap<String, Promise>()
  private val negotiatedMtu = ConcurrentHashMap<String, Int>()
  private val writeQueues = ConcurrentHashMap<String, ArrayDeque<PendingWrite>>()
  private val activeWrites = ConcurrentHashMap<String, PendingWrite>()
  private val sessionTimeouts = ConcurrentHashMap<String, Runnable>()
  private val sessionRecordsAccepted = ConcurrentHashMap<String, Int>()
  private val sessionBytesTransferred = ConcurrentHashMap<String, Int>()
  private val classicSockets = ConcurrentHashMap<String, BluetoothSocket>()
  private var classicServer: BluetoothServerSocket? = null
  private var classicReceiverRegistered = false
  private var selectedMode = "ble"
  private var advertiser: BluetoothLeAdvertiser? = null
  private var scanner: BluetoothLeScanner? = null
  private var gattServer: BluetoothGattServer? = null
  private var advertisement = byteArrayOf()
  /** True only after the controller confirms the advertisement through onStartSuccess. */
  private var advertisingConfirmed = false
  /** Guards the one-shot DEC-006 switch to Bluetooth Classic. */
  private var classicFallbackAttempted = false
  /** True between startRelay() and stopRelay(); makes startRelay idempotent. */
  private var relayRunning = false
  private var sessionCounter = 0
  private val mainHandler = Handler(Looper.getMainLooper())
  private var stopReceiverRegistered = false
  private var wavePxReceiver: WavePxAudioReceiver? = null
  private var wavePxDirectDecoder = -1

  private data class PendingWrite(val packetId: String, val bytes: ByteArray, val promise: Promise)

  override fun definition() = ModuleDefinition {
    Name("AndroidRadioBridge")
    Events("onTransportEvent")
    AsyncFunction("getCapabilities") { capabilityReport() }
    AsyncFunction("requestPermissions") { promise: Promise ->
      val requested = mutableListOf(Manifest.permission.RECORD_AUDIO)
      if (Build.VERSION.SDK_INT >= 31) requested += listOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_ADVERTISE, Manifest.permission.BLUETOOTH_CONNECT)
      else requested += Manifest.permission.ACCESS_FINE_LOCATION
      if (Build.VERSION.SDK_INT >= 33) requested += Manifest.permission.POST_NOTIFICATIONS
      val permissions = appContext.permissions
      if (permissions == null) promise.reject("E_PERMISSIONS", "Permissions service is unavailable", null)
      else Permissions.askForPermissionsWithPermissionsManager(permissions, promise, *requested.toTypedArray())
    }
    AsyncFunction("requestWavePxPermission") { promise: Promise ->
      val permissions = appContext.permissions
      if (permissions == null) promise.reject("E_PERMISSIONS", "Permissions service is unavailable", null)
      else Permissions.askForPermissionsWithPermissionsManager(permissions, promise, Manifest.permission.RECORD_AUDIO)
    }
    AsyncFunction("startRelay") { advertisementBase64: String, mode: String -> startRelay(advertisementBase64, mode) }
    AsyncFunction("stopRelay") { stopRelay() }
    AsyncFunction("updateAdvertisement") { value: String -> advertisement = Base64.decode(value, Base64.NO_WRAP); restartAdvertising() }
    AsyncFunction("openSession") { peerToken: String, mode: String, promise: Promise -> openSession(peerToken, mode, promise) }
    AsyncFunction("closeSession") { sessionId: String -> closeSession(sessionId) }
    AsyncFunction("sendRecord") { sessionId: String, packetId: String, bytesBase64: String, promise: Promise -> sendRecord(sessionId, packetId, Base64.decode(bytesBase64, Base64.NO_WRAP), promise) }
    AsyncFunction("cancelTransfer") { sessionId: String -> closeSession(sessionId) }
    AsyncFunction("startWavePxListening") { timeoutMs: Double -> startWavePxListening(timeoutMs.toLong()) }
    AsyncFunction("stopWavePxListening") { stopWavePxListening() }
    AsyncFunction("feedWavePxDirectPcm") { pcmBase64: String, sampleRateHz: Int -> feedWavePxDirectPcm(pcmBase64, sampleRateHz) }
    OnDestroy { stopWavePxListening(); stopRelay() }
  }

  private fun startWavePxListening(timeoutMs: Long) {
    stopWavePxListening()
    val boundedTimeout = timeoutMs.coerceIn(1_000L, 120_000L)
    val receiver = WavePxAudioReceiver(
      context,
      onFrame = { bytes, atMs -> wavePxFrame(bytes, "tier2-mic", atMs) },
      onStopped = { reason, atMs -> emit(mapOf("kind" to "wavepx-listening-state", "state" to "stopped", "reason" to reason, "atMs" to atMs)) },
      onError = { code, message, _ -> transportError(code, message, true) },
    )
    wavePxReceiver = receiver
    receiver.start(boundedTimeout)
    emit(mapOf("kind" to "wavepx-listening-state", "state" to "listening", "timeoutMs" to boundedTimeout, "atMs" to System.currentTimeMillis()))
  }

  private fun stopWavePxListening() {
    wavePxReceiver?.stop()
    wavePxReceiver = null
    if (wavePxDirectDecoder >= 0) {
      WavePxNative.destroyDecoder(wavePxDirectDecoder)
      wavePxDirectDecoder = -1
    }
  }

  private fun feedWavePxDirectPcm(pcmBase64: String, sampleRateHz: Int) {
    if (sampleRateHz !in 8_000..96_000) throw IllegalArgumentException("WavePX sample rate is outside 8-96 kHz")
    if (wavePxDirectDecoder < 0) wavePxDirectDecoder = WavePxNative.createF32Decoder(sampleRateHz)
    if (wavePxDirectDecoder < 0) throw IllegalStateException("WavePX direct decoder could not initialize")
    val decoded = WavePxNative.decodeF32(wavePxDirectDecoder, Base64.decode(pcmBase64, Base64.NO_WRAP))
    if (decoded != null && decoded.isNotEmpty()) wavePxFrame(decoded, "tier2-direct", System.currentTimeMillis())
  }

  private fun wavePxFrame(bytes: ByteArray, source: String, atMs: Long) {
    emit(mapOf(
      "kind" to "wavepx-frame-native",
      "bytesBase64" to Base64.encodeToString(bytes, Base64.NO_WRAP),
      "source" to source,
      "atMs" to atMs,
    ))
  }

  private fun permission(name: String): String = if (ContextCompat.checkSelfPermission(context, name) == PackageManager.PERMISSION_GRANTED) "granted" else "denied"

  private fun hasBluetoothRuntimePermissions(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      return ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    }
    return listOf(
      Manifest.permission.BLUETOOTH_SCAN,
      Manifest.permission.BLUETOOTH_ADVERTISE,
      Manifest.permission.BLUETOOTH_CONNECT,
    ).all { ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED }
  }

  @SuppressLint("MissingPermission")
  private fun capabilityReport(): Map<String, Any?> {
    val bt = adapter
    val packageManager = context.packageManager
    val battery = context.getSystemService(BatteryManager::class.java).getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
    val batteryTemperatureTenths = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
      ?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, Int.MIN_VALUE)
    val thermal = if (Build.VERSION.SDK_INT >= 29) context.getSystemService(PowerManager::class.java).currentThermalStatus >= PowerManager.THERMAL_STATUS_SEVERE else false
    val ble = packageManager.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE)
    return mapOf(
      "androidApiLevel" to Build.VERSION.SDK_INT,
      "bluetoothAvailable" to (bt != null), "bluetoothEnabled" to (bt?.isEnabled == true),
      "bleScanSupported" to ble, "bleAdvertiseSupported" to (bt?.bluetoothLeAdvertiser != null),
      "multipleAdvertisementSupported" to (bt?.isMultipleAdvertisementSupported == true),
      "gattClientSupported" to ble, "gattServerSupported" to ble,
      "extendedAdvertisingSupported" to (Build.VERSION.SDK_INT >= 26 && bt?.isLeExtendedAdvertisingSupported == true),
      "codedPhySupported" to (Build.VERSION.SDK_INT >= 26 && bt?.isLeCodedPhySupported == true),
      "maxAdvertisingDataLength" to if (Build.VERSION.SDK_INT >= 26) bt?.leMaximumAdvertisingDataLength else 31,
      "audioInputAvailable" to packageManager.hasSystemFeature(PackageManager.FEATURE_MICROPHONE),
      "permissions" to mapOf(
        "bluetoothScan" to if (Build.VERSION.SDK_INT >= 31) permission(Manifest.permission.BLUETOOTH_SCAN) else permission(Manifest.permission.ACCESS_FINE_LOCATION),
        "bluetoothAdvertise" to if (Build.VERSION.SDK_INT >= 31) permission(Manifest.permission.BLUETOOTH_ADVERTISE) else "granted",
        "bluetoothConnect" to if (Build.VERSION.SDK_INT >= 31) permission(Manifest.permission.BLUETOOTH_CONNECT) else "granted",
        "location" to permission(Manifest.permission.ACCESS_FINE_LOCATION), "notifications" to if (Build.VERSION.SDK_INT >= 33) permission(Manifest.permission.POST_NOTIFICATIONS) else "granted",
        "microphone" to permission(Manifest.permission.RECORD_AUDIO),
        "foregroundService" to if (Build.VERSION.SDK_INT >= 28) permission(Manifest.permission.FOREGROUND_SERVICE) else "granted"
      ),
      "batteryPercent" to battery.takeIf { it in 0..100 },
      "batteryTemperatureC" to batteryTemperatureTenths?.takeIf { it != Int.MIN_VALUE }?.div(10.0),
      "batteryOptimisationRestricted" to !context.getSystemService(PowerManager::class.java).isIgnoringBatteryOptimizations(context.packageName),
      "thermalThrottled" to thermal, "simulated" to false, "observedAtMs" to System.currentTimeMillis()
    )
  }

  @SuppressLint("MissingPermission")
  private fun startRelay(base64: String, mode: String) {
    if (!hasBluetoothRuntimePermissions()) {
      relayState("permission-required", "Grant Nearby Devices permissions before starting relay mode")
      throw SecurityException("Nearby Devices permissions are required before starting Bluetooth relay mode")
    }
    advertisement = Base64.decode(base64, Base64.NO_WRAP)

    // IDEMPOTENT. Re-entering startRelay while already relaying used to
    // re-register the GATT service and re-advertise, which the controller
    // refuses with ADVERTISE_FAILED_ALREADY_STARTED / SCAN_FAILED_ALREADY_STARTED
    // and which left an ORPHANED BluetoothGattServer behind each time --
    // `gattServer` was overwritten without closing the previous instance. A peer
    // then ran service discovery against a server whose service registration had
    // been disturbed and got E_GATT_SERVICE, so sessions connected and died
    // before the inventory phase.
    //
    // relay-loop.ts guards this too; this is the backstop, because the native
    // layer owns the radio and must not be corruptible by a double call.
    if (relayRunning) {
      restartAdvertising()
      return
    }
    relayRunning = true

    selectedMode = mode
    registerStopReceiver()
    ContextCompat.startForegroundService(context, Intent(context, RelayForegroundService::class.java))
    relayState("starting", "$mode transport selected")
    if (mode == "classic") {
      startClassic()
      relayState("advertising-scanning", "Bluetooth Classic discovery and RFCOMM relay are active")
      return
    }
    openGattServer()
    startScanning()
    // startAdvertising() reports success or failure asynchronously through
    // advertiseCallback, which is where "advertising-scanning" is emitted. Do
    // NOT claim the radio is live here: this method previously reported a
    // healthy transport while the controller was rejecting the advertisement.
    startAdvertising()
  }

  @SuppressLint("MissingPermission")
  private fun stopRelay() {
    try { advertiser?.stopAdvertising(advertiseCallback) } catch (_: Exception) {}
    try { scanner?.stopScan(scanCallback) } catch (_: Exception) {}
    try { adapter?.cancelDiscovery() } catch (_: Exception) {}
    if (classicReceiverRegistered) { try { context.unregisterReceiver(classicReceiver) } catch (_: Exception) {}; classicReceiverRegistered = false }
    try { classicServer?.close() } catch (_: Exception) {}; classicServer = null
    classicSockets.values.forEach { try { it.close() } catch (_: Exception) {} }; classicSockets.clear()
    clientGatts.values.forEach { it.close() }; clientGatts.clear(); gattServer?.close(); gattServer = null
    pendingSessions.forEach { (_, promise) -> promise.reject("E_RELAY_STOPPED", "Relay stopped before the session opened", null) }; pendingSessions.clear()
    activeWrites.forEach { (_, write) -> write.promise.reject("E_RELAY_STOPPED", "Relay stopped before the record was written", null) }; activeWrites.clear()
    writeQueues.values.forEach { queue -> while (queue.isNotEmpty()) queue.removeFirst().promise.reject("E_RELAY_STOPPED", "Relay stopped before the record was written", null) }; writeQueues.clear()
    sessionTimeouts.values.forEach(mainHandler::removeCallbacks); sessionTimeouts.clear(); negotiatedMtu.clear(); sessionPeers.clear(); serverDevices.clear(); sessionRecordsAccepted.clear(); sessionBytesTransferred.clear()
    advertisingConfirmed = false; classicFallbackAttempted = false; relayRunning = false
    unregisterStopReceiver()
    context.stopService(Intent(context, RelayForegroundService::class.java)); relayState("stopped", "relay stopped")
  }

  private val stopRelayReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      if (intent?.action == RelayForegroundService.ACTION_STOP_RELAY) stopRelay()
    }
  }

  private fun registerStopReceiver() {
    if (stopReceiverRegistered) return
    val filter = IntentFilter(RelayForegroundService.ACTION_STOP_RELAY)
    if (Build.VERSION.SDK_INT >= 33) context.registerReceiver(stopRelayReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
    else @Suppress("DEPRECATION") context.registerReceiver(stopRelayReceiver, filter)
    stopReceiverRegistered = true
  }

  private fun unregisterStopReceiver() {
    if (!stopReceiverRegistered) return
    try { context.unregisterReceiver(stopRelayReceiver) } catch (_: Exception) {}
    stopReceiverRegistered = false
  }

  /**
   * Publishes the 12-byte discovery payload as manufacturer-specific data.
   *
   * The 128-bit SERVICE_UUID is deliberately NOT advertised. A legacy
   * advertising PDU carries 31 bytes; a complete 128-bit UUID AD element costs
   * 18 of them, which together with the mandatory Flags element (3) and our
   * manufacturer element (4 + 12) totals 37 and is rejected by the controller
   * as ADVERTISE_FAILED_DATA_TOO_LARGE. Peers match on company id 0xffff plus
   * the 0xd5 magic byte (see startScanning), and SERVICE_UUID is exchanged
   * after connection -- GATT service discovery and the RFCOMM record -- where
   * there is no size pressure. This mirrors buildAdvertisingPdu() in
   * packages/transport-core, which models exactly these two AD elements.
   */
  @SuppressLint("MissingPermission")
  private fun startAdvertising() {
    advertiser = adapter?.bluetoothLeAdvertiser ?: throw IllegalStateException("BLE advertising unavailable")

    // Fail loudly at the source rather than as an opaque controller error code.
    val pduBytes = FLAGS_ELEMENT_BYTES + MANUFACTURER_HEADER_BYTES + advertisement.size
    if (pduBytes > ADVERTISING_PDU_BYTES) {
      transportError(
        "BLE_ADVERTISE_PDU_OVERFLOW",
        "Advertising PDU would be ${pduBytes}B, over the ${ADVERTISING_PDU_BYTES}B legacy limit",
        true,
      )
      onAdvertisingUnavailable("advertising payload does not fit a legacy PDU")
      return
    }

    val settings = AdvertiseSettings.Builder().setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_POWER).setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM).setConnectable(true).build()
    val data = AdvertiseData.Builder().setIncludeDeviceName(false).addManufacturerData(COMPANY_ID, advertisement).build()
    advertiser?.startAdvertising(settings, data, advertiseCallback)
  }

  @SuppressLint("MissingPermission")
  private fun restartAdvertising() { if (advertiser == null) return; advertiser?.stopAdvertising(advertiseCallback); startAdvertising() }

  private val advertiseCallback = object : AdvertiseCallback() {
    override fun onStartSuccess(settingsInEffect: AdvertiseSettings?) {
      advertisingConfirmed = true
      relayState("advertising-scanning", "BLE advertising, scanning and GATT are active")
    }

    override fun onStartFailure(errorCode: Int) {
      val reason = advertiseFailureReason(errorCode)
      transportError("BLE_ADVERTISE_$errorCode", "BLE advertising failed: $reason", true)
      // Scanning alone cannot make this node discoverable: a node that never
      // advertises is invisible to every peer, so BLE relay is not merely
      // degraded, it is inoperative. Fall back rather than report a radio that
      // is not transmitting. A failure AFTER a confirmed start leaves the
      // existing BLE session work intact and is reported without a switch.
      if (!advertisingConfirmed) onAdvertisingUnavailable(reason)
    }
  }

  private fun advertiseFailureReason(code: Int): String = when (code) {
    AdvertiseCallback.ADVERTISE_FAILED_DATA_TOO_LARGE -> "advertising data too large"
    AdvertiseCallback.ADVERTISE_FAILED_TOO_MANY_ADVERTISERS -> "controller has too many advertisers"
    AdvertiseCallback.ADVERTISE_FAILED_ALREADY_STARTED -> "advertising already started"
    AdvertiseCallback.ADVERTISE_FAILED_INTERNAL_ERROR -> "internal controller error"
    AdvertiseCallback.ADVERTISE_FAILED_FEATURE_UNSUPPORTED -> "advertising unsupported on this device"
    else -> "error $code"
  }

  /**
   * DEC-006 contingency, triggered at runtime instead of by capability report.
   *
   * getCapabilities() can only report that a BluetoothLeAdvertiser object
   * exists, which is true on devices whose controller then refuses to start.
   * This is the gate that catches that case: it switches to the Bluetooth
   * Classic adapter once, behind the same session contract, so packet, policy,
   * map and UI rules are unchanged and only the radio differs.
   */
  @SuppressLint("MissingPermission")
  private fun onAdvertisingUnavailable(reason: String) {
    if (selectedMode == "classic" || classicFallbackAttempted) return
    classicFallbackAttempted = true
    mainHandler.post {
      try { advertiser?.stopAdvertising(advertiseCallback) } catch (_: Exception) {}
      try { scanner?.stopScan(scanCallback) } catch (_: Exception) {}
      advertiser = null; scanner = null
      clientGatts.values.forEach { it.close() }; clientGatts.clear()
      try { gattServer?.close() } catch (_: Exception) {}; gattServer = null
      // selectedMode is what openSession() and recordReceived() read, so the
      // whole native surface follows this one assignment.
      selectedMode = "classic"
      try {
        startClassic()
        relayState("advertising-scanning", "Bluetooth Classic relay active: BLE advertising unavailable ($reason)")
      } catch (error: Exception) {
        relayState("error-user-action-required", "Neither BLE advertising nor Bluetooth Classic is available: ${error.message}")
      }
    }
  }

  @SuppressLint("MissingPermission")
  private fun startScanning() {
    scanner = adapter?.bluetoothLeScanner ?: throw IllegalStateException("BLE scanning unavailable")
    val filter = ScanFilter.Builder().setManufacturerData(COMPANY_ID, byteArrayOf(MAGIC.toByte()), byteArrayOf(0xff.toByte())).build()
    val settings = ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_POWER).build()
    scanner?.startScan(listOf(filter), settings, scanCallback)
  }

  @SuppressLint("MissingPermission")
  private fun startClassic() {
    val bt = adapter ?: throw IllegalStateException("Bluetooth unavailable")
    if (!classicReceiverRegistered) {
      context.registerReceiver(classicReceiver, IntentFilter(BluetoothDevice.ACTION_FOUND))
      classicReceiverRegistered = true
    }
    bt.bondedDevices.forEach { observeClassic(it) }
    bt.startDiscovery()
    classicServer = bt.listenUsingRfcommWithServiceRecord("Disaster SOS Mesh", SERVICE_UUID)
    Thread {
      while (classicServer != null) {
        try {
          val socket = classicServer?.accept() ?: break
          val peer = classicToken(socket.remoteDevice.address)
          val sessionId = "classic-in-${System.currentTimeMillis()}-${++sessionCounter}"
          classicSockets[sessionId] = socket; sessionPeers[sessionId] = peer
          sessionEvent(sessionId, peer, false); readClassic(sessionId, socket)
        } catch (_: Exception) { break }
      }
    }.start()
  }

  private val classicReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      if (intent?.action != BluetoothDevice.ACTION_FOUND) return
      val device = if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice::class.java) else @Suppress("DEPRECATION") intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
      if (device != null) observeClassic(device)
    }
  }

  @SuppressLint("MissingPermission")
  private fun observeClassic(device: BluetoothDevice) {
    val token = classicToken(device.address)
    peerDevices[token] = device; addressTokens[device.address] = token
    val summary = ByteArray(12)
    summary[0] = MAGIC.toByte(); summary[1] = 0x10
    val tokenBytes = token.chunked(2).map { it.toInt(16).toByte() }
    tokenBytes.take(4).forEachIndexed { index, byte -> summary[2 + index] = byte }
    summary[6] = 0x07; summary[11] = 0x40
    emit(mapOf("kind" to "peer-advertisement", "bytesBase64" to Base64.encodeToString(summary, Base64.NO_WRAP), "atMs" to System.currentTimeMillis()))
  }

  private fun classicToken(address: String): String {
    val window = System.currentTimeMillis() / (15 * 60 * 1000)
    return MessageDigest.getInstance("SHA-256").digest("$address:$window".toByteArray()).take(4).joinToString("") { "%02x".format(it) }
  }

  private val scanCallback = object : ScanCallback() {
    override fun onScanResult(callbackType: Int, result: ScanResult) {
      val bytes = result.scanRecord?.getManufacturerSpecificData(COMPANY_ID) ?: return
      if (bytes.size < 12 || bytes[0].toInt() and 0xff != MAGIC) return
      val token = bytes.sliceArray(2..5).joinToString("") { "%02x".format(it) }
      peerDevices[token] = result.device; addressTokens[result.device.address] = token
      emit(mapOf("kind" to "peer-advertisement", "bytesBase64" to Base64.encodeToString(bytes, Base64.NO_WRAP), "rssi" to result.rssi, "atMs" to System.currentTimeMillis()))
    }
    override fun onScanFailed(errorCode: Int) { transportError("BLE_SCAN_$errorCode", "BLE scan failed", true) }
  }

  @SuppressLint("MissingPermission")
  private fun openGattServer() {
    val server = manager?.openGattServer(context, serverCallback) ?: throw IllegalStateException("GATT server unavailable")
    val rx = BluetoothGattCharacteristic(RX_UUID, BluetoothGattCharacteristic.PROPERTY_WRITE, BluetoothGattCharacteristic.PERMISSION_WRITE)
    val tx = BluetoothGattCharacteristic(TX_UUID, BluetoothGattCharacteristic.PROPERTY_NOTIFY, BluetoothGattCharacteristic.PERMISSION_READ)
    tx.addDescriptor(BluetoothGattDescriptor(CCCD_UUID, BluetoothGattDescriptor.PERMISSION_READ or BluetoothGattDescriptor.PERMISSION_WRITE))
    server.addService(BluetoothGattService(SERVICE_UUID, BluetoothGattService.SERVICE_TYPE_PRIMARY).apply { addCharacteristic(rx); addCharacteristic(tx) })
    gattServer = server
  }

  @SuppressLint("MissingPermission")
  private fun openSession(peerToken: String, requestedMode: String, promise: Promise) {
    // selectedMode is authoritative. The JS adapter fixes its mode at
    // construction and cannot know about a runtime fallback to Classic, so a
    // stale "ble" request after onAdvertisingUnavailable() must not reach
    // connectGatt on a Classic-discovered device.
    val mode = if (selectedMode == "classic") "classic" else requestedMode
    if (mode == "classic") { openClassicSession(peerToken, promise); return }
    val device = peerDevices[peerToken] ?: run { promise.reject("E_PEER_GONE", "Peer is no longer observable", null); return }
    val sessionId = "ble-${System.currentTimeMillis()}-${++sessionCounter}"
    sessionPeers[sessionId] = peerToken; pendingSessions[sessionId] = promise
    scheduleSessionTimeout(sessionId)
    val gatt = if (Build.VERSION.SDK_INT >= 23) device.connectGatt(context, false, clientCallback, BluetoothDevice.TRANSPORT_LE) else device.connectGatt(context, false, clientCallback)
    clientGatts[sessionId] = gatt
  }

  @SuppressLint("MissingPermission")
  private fun openClassicSession(peerToken: String, promise: Promise) {
    val device = peerDevices[peerToken] ?: run { promise.reject("E_PEER_GONE", "Classic peer is no longer observable", null); return }
    val sessionId = "classic-${System.currentTimeMillis()}-${++sessionCounter}"
    Thread {
      try {
        adapter?.cancelDiscovery()
        val socket = device.createRfcommSocketToServiceRecord(SERVICE_UUID)
        socket.connect()
        classicSockets[sessionId] = socket; sessionPeers[sessionId] = peerToken
        promise.resolve(sessionId); sessionEvent(sessionId, peerToken, true); readClassic(sessionId, socket)
      } catch (error: Exception) { promise.reject("E_CLASSIC_CONNECT", error.message ?: "Classic connection failed", error) }
    }.start()
  }

  private fun readClassic(sessionId: String, socket: BluetoothSocket) {
    Thread {
      val input = DataInputStream(socket.inputStream)
      try {
        while (classicSockets[sessionId] === socket) {
          val length = input.readUnsignedShort()
          if (length !in 1..244) throw IllegalStateException("Classic frame outside packet budget")
          val bytes = ByteArray(length); input.readFully(bytes)
          recordReceived(sessionId, sessionPeers[sessionId] ?: "", bytes)
        }
      } catch (_: Exception) { classicSockets.remove(sessionId); closeFromNative(sessionId, "peer-closed") }
    }.start()
  }

  private val clientCallback = object : BluetoothGattCallback() {
    @SuppressLint("MissingPermission")
    override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
      val sessionId = clientGatts.entries.firstOrNull { it.value == gatt }?.key ?: return
      if (newState == BluetoothProfile.STATE_CONNECTED) {
        // HD-011: "must negotiate MTU 247 and FAIL LOUDLY if the peer refuses,
        // never silently truncate a record." Continuing to service discovery
        // here left negotiatedMtu unset, so the budget silently fell back to
        // the 23-byte default and every record failed much later, one at a
        // time, with no indication that MTU was the cause.
        if (!gatt.requestMtu(REQUIRED_ATT_MTU)) {
          failSession(sessionId, "E_GATT_MTU_NEGOTIATION", "Could not start ATT MTU negotiation with the peer")
        }
      } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
        rejectPendingSession(sessionId, "E_GATT_DISCONNECTED", "Peer disconnected before the session was ready")
        failWrites(sessionId, "E_GATT_DISCONNECTED", "Peer disconnected before the record was written")
        closeFromNative(sessionId, if (status == BluetoothGatt.GATT_SUCCESS) "peer-closed" else "error")
      }
    }
    @SuppressLint("MissingPermission")
    override fun onMtuChanged(gatt: BluetoothGatt, mtu: Int, status: Int) {
      val sessionId = clientGatts.entries.firstOrNull { it.value == gatt }?.key ?: return
      // The granted MTU is reported so the failure names the actual number:
      // if this rejects real handsets, that value is what tells you whether
      // REQUIRED_ATT_MTU should be relaxed, and by how much.
      if (status != BluetoothGatt.GATT_SUCCESS) {
        failSession(sessionId, "E_GATT_MTU_NEGOTIATION", "Peer refused ATT MTU negotiation (status $status)")
        return
      }
      if (mtu < REQUIRED_ATT_MTU) {
        failSession(
          sessionId,
          "E_GATT_MTU_TOO_SMALL",
          "Peer granted ATT MTU $mtu, below the $REQUIRED_ATT_MTU this build requires to fit a $MAX_RECORD_BYTES-byte record in one write",
        )
        return
      }
      negotiatedMtu[sessionId] = mtu
      gatt.discoverServices()
    }
    @SuppressLint("MissingPermission")
    override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
      val sessionId = clientGatts.entries.firstOrNull { it.value == gatt }?.key ?: return
      if (status != BluetoothGatt.GATT_SUCCESS || gatt.getService(SERVICE_UUID) == null) { rejectPendingSession(sessionId, "E_GATT_SERVICE", "Peer does not expose the DSM service (service discovery found no $SERVICE_UUID)"); closeFromNative(sessionId, "error"); return }
      val tx = gatt.getService(SERVICE_UUID)?.getCharacteristic(TX_UUID)
      val descriptor = tx?.getDescriptor(CCCD_UUID)
      if (tx == null || descriptor == null || !gatt.setCharacteristicNotification(tx, true)) {
        rejectPendingSession(sessionId, "E_GATT_NOTIFY", "Peer notification channel is unavailable")
        closeSession(sessionId)
        return
      }
      val started = if (Build.VERSION.SDK_INT >= 33) {
        gatt.writeDescriptor(descriptor, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE) == BluetoothStatusCodes.SUCCESS
      } else {
        @Suppress("DEPRECATION")
        descriptor.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
        @Suppress("DEPRECATION")
        gatt.writeDescriptor(descriptor)
      }
      if (!started) {
        rejectPendingSession(sessionId, "E_GATT_NOTIFY", "Could not subscribe to the peer notification channel")
        closeSession(sessionId)
      }
    }
    override fun onDescriptorWrite(gatt: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) {
      if (descriptor.uuid != CCCD_UUID) return
      val sessionId = clientGatts.entries.firstOrNull { it.value == gatt }?.key ?: return
      if (status != BluetoothGatt.GATT_SUCCESS) {
        rejectPendingSession(sessionId, "E_GATT_NOTIFY", "Peer notification subscription failed")
        closeSession(sessionId)
        return
      }
      cancelSessionTimeout(sessionId)
      pendingSessions.remove(sessionId)?.resolve(sessionId)
      sessionEvent(sessionId, sessionPeers[sessionId] ?: "", true)
    }
    override fun onCharacteristicWrite(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
      if (characteristic.uuid != RX_UUID) return
      val sessionId = clientGatts.entries.firstOrNull { it.value == gatt }?.key ?: return
      completeWrite(sessionId, status == BluetoothGatt.GATT_SUCCESS, if (status == BluetoothGatt.GATT_SUCCESS) null else "GATT write failed with status $status")
    }
    override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) { receiveClient(gatt, characteristic.value) }
    override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray) { receiveClient(gatt, value) }
  }

  private val serverCallback = object : BluetoothGattServerCallback() {
    override fun onConnectionStateChange(device: BluetoothDevice, status: Int, newState: Int) {
      if (newState == BluetoothProfile.STATE_CONNECTED) {
        val peer = addressTokens[device.address] ?: device.address.replace(":", "").takeLast(8).lowercase()
        val sessionId = "ble-in-${System.currentTimeMillis()}-${++sessionCounter}"
        serverDevices[sessionId] = device; sessionPeers[sessionId] = peer; negotiatedMtu[sessionId] = 23; sessionEvent(sessionId, peer, false)
      } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
        val sessionId = serverDevices.entries.firstOrNull { it.value.address == device.address }?.key ?: return
        failWrites(sessionId, "E_GATT_DISCONNECTED", "Peer disconnected before the record was written")
        serverDevices.remove(sessionId); closeFromNative(sessionId, if (status == BluetoothGatt.GATT_SUCCESS) "peer-closed" else "error")
      }
    }
    override fun onMtuChanged(device: BluetoothDevice, mtu: Int) {
      val sessionId = serverDevices.entries.firstOrNull { it.value.address == device.address }?.key ?: return
      negotiatedMtu[sessionId] = mtu
    }
    @SuppressLint("MissingPermission")
    /**
     * Answers the CCCD subscribe. WITHOUT THIS THE SESSION CANNOT COMPLETE.
     *
     * Writing the Client Characteristic Configuration Descriptor is how a peer
     * subscribes to our TX notifications, and it is the LAST step of
     * openSession on the initiating side. Android's default implementation of
     * this callback does nothing at all -- in particular it never calls
     * sendResponse() -- so the initiator sat waiting for an ATT response that
     * was never sent, its onDescriptorWrite never fired, openSession never
     * resolved, and the session died on its 15s setup timeout.
     *
     * Observed exactly that way: connection established, onConfigureMTU
     * status=0 mtu=517, onSearchComplete status=0, then silence until
     * E_GATT_TIMEOUT. Every ATT request with responseNeeded MUST be answered.
     */
    override fun onDescriptorWriteRequest(device: BluetoothDevice, requestId: Int, descriptor: BluetoothGattDescriptor, preparedWrite: Boolean, responseNeeded: Boolean, offset: Int, value: ByteArray) {
      val accepted = descriptor.uuid == CCCD_UUID && !preparedWrite && offset == 0
      if (responseNeeded) {
        gattServer?.sendResponse(
          device,
          requestId,
          if (accepted) BluetoothGatt.GATT_SUCCESS else BluetoothGatt.GATT_FAILURE,
          offset,
          value,
        )
      }
    }

    /** Some stacks read the CCCD before writing it; an unanswered read stalls the same way. */
    override fun onDescriptorReadRequest(device: BluetoothDevice, requestId: Int, offset: Int, descriptor: BluetoothGattDescriptor) {
      val payload = if (descriptor.uuid == CCCD_UUID) BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE else byteArrayOf()
      gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, payload)
    }

    override fun onCharacteristicWriteRequest(device: BluetoothDevice, requestId: Int, characteristic: BluetoothGattCharacteristic, preparedWrite: Boolean, responseNeeded: Boolean, offset: Int, value: ByteArray) {
      // Bounded against the PROTOCOL constant, not this session's negotiated
      // MTU. One physical link has two session ids -- the initiator's
      // "ble-..." and this side's "ble-in-..." -- and the server-side entry
      // starts at 23 until BluetoothGattServerCallback.onMtuChanged fires. If
      // the first write lands before that callback, checking the negotiated
      // value rejects a perfectly valid record. Android already enforces the
      // negotiated MTU at the link layer, so an oversized write cannot arrive
      // intact; the only thing this check can add is a size bound, and
      // MAX_RECORD_BYTES is the real one (02-... bounded record sizes).
      val accepted = characteristic.uuid == RX_UUID && !preparedWrite && offset == 0 && value.size <= MAX_RECORD_BYTES
      if (accepted) {
        val sessionId = serverDevices.entries.firstOrNull { it.value.address == device.address }?.key ?: return
        recordReceived(sessionId, sessionPeers[sessionId] ?: "", value)
      }
      if (responseNeeded) gattServer?.sendResponse(device, requestId, if (accepted) BluetoothGatt.GATT_SUCCESS else BluetoothGatt.GATT_INVALID_OFFSET, 0, null)
    }
    override fun onNotificationSent(device: BluetoothDevice, status: Int) {
      val sessionId = serverDevices.entries.firstOrNull { it.value.address == device.address }?.key ?: return
      completeWrite(sessionId, status == BluetoothGatt.GATT_SUCCESS, if (status == BluetoothGatt.GATT_SUCCESS) null else "GATT notification failed with status $status")
    }
  }

  private fun receiveClient(gatt: BluetoothGatt, bytes: ByteArray) {
    val sessionId = clientGatts.entries.firstOrNull { it.value == gatt }?.key ?: return
    recordReceived(sessionId, sessionPeers[sessionId] ?: "", bytes)
  }

  @SuppressLint("MissingPermission")
  private fun sendRecord(sessionId: String, packetId: String, bytes: ByteArray, promise: Promise) {
    require(bytes.size <= 244) { "record exceeds negotiated single-write budget" }
    val classic = classicSockets[sessionId]
    if (classic != null) {
      try {
        val output = DataOutputStream(classic.outputStream)
        output.writeShort(bytes.size); output.write(bytes); output.flush()
        recordSent(sessionId, packetId, bytes.size); promise.resolve(null)
      } catch (error: Exception) {
        promise.reject("E_CLASSIC_WRITE", error.message ?: "Classic record write failed", error)
      }
      return
    }
    if (!clientGatts.containsKey(sessionId) && !serverDevices.containsKey(sessionId)) {
      promise.reject("E_UNKNOWN_SESSION", "Session is no longer active", null)
      return
    }
    // SENDING deliberately still uses the negotiated value rather than the
    // protocol constant: writing more than the link actually negotiated fails
    // at the controller, so under-sending is the safe direction. (The inbound
    // check in onCharacteristicWriteRequest is the opposite case -- there a
    // stale value can only cause a FALSE rejection.)
    //
    // With MTU negotiation now gated in onMtuChanged, an absent or small value
    // here means the session was established without a usable MTU, so the
    // message says so instead of just quoting a number.
    val payloadBudget = (negotiatedMtu[sessionId] ?: 23) - 3
    if (bytes.size > payloadBudget) {
      promise.reject(
        "E_GATT_MTU",
        "Record is ${bytes.size} bytes but this session's GATT payload budget is $payloadBudget" +
          (if (negotiatedMtu[sessionId] == null) " (ATT MTU was never negotiated for this session)" else ""),
        null,
      )
      return
    }
    val queue = writeQueues.getOrPut(sessionId) { ArrayDeque() }
    synchronized(queue) { queue.addLast(PendingWrite(packetId, bytes, promise)) }
    startNextWrite(sessionId)
  }

  @SuppressLint("MissingPermission")
  private fun startNextWrite(sessionId: String) {
    if (activeWrites.containsKey(sessionId)) return
    val queue = writeQueues[sessionId] ?: return
    val next = synchronized(queue) { if (queue.isEmpty()) null else queue.removeFirst() } ?: run { writeQueues.remove(sessionId); return }
    activeWrites[sessionId] = next
    val started = try {
      val client = clientGatts[sessionId]
      if (client != null) {
        val characteristic = client.getService(SERVICE_UUID)?.getCharacteristic(RX_UUID) ?: throw IllegalStateException("GATT RX characteristic unavailable")
        if (Build.VERSION.SDK_INT >= 33) client.writeCharacteristic(characteristic, next.bytes, BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT) == BluetoothStatusCodes.SUCCESS
        else {
          @Suppress("DEPRECATION")
          characteristic.value = next.bytes
          @Suppress("DEPRECATION")
          client.writeCharacteristic(characteristic)
        }
      } else {
        val device = serverDevices[sessionId] ?: throw IllegalStateException("unknown session")
        val characteristic = gattServer?.getService(SERVICE_UUID)?.getCharacteristic(TX_UUID) ?: throw IllegalStateException("GATT TX characteristic unavailable")
        if (Build.VERSION.SDK_INT >= 33) gattServer?.notifyCharacteristicChanged(device, characteristic, false, next.bytes) == BluetoothStatusCodes.SUCCESS
        else {
          @Suppress("DEPRECATION")
          characteristic.value = next.bytes
          @Suppress("DEPRECATION")
          gattServer?.notifyCharacteristicChanged(device, characteristic, false) == true
        }
      }
    } catch (error: Exception) {
      activeWrites.remove(sessionId)
      next.promise.reject("E_GATT_WRITE", error.message ?: "GATT record write failed", error)
      startNextWrite(sessionId)
      return
    }
    if (!started) completeWrite(sessionId, false, "Android rejected the GATT operation before transmission")
  }

  private fun completeWrite(sessionId: String, success: Boolean, detail: String?) {
    val write = activeWrites.remove(sessionId) ?: return
    if (success) {
      recordSent(sessionId, write.packetId, write.bytes.size)
      write.promise.resolve(null)
    } else write.promise.reject("E_GATT_WRITE", detail ?: "GATT record write failed", null)
    startNextWrite(sessionId)
  }

  private fun failWrites(sessionId: String, code: String, message: String) {
    activeWrites.remove(sessionId)?.promise?.reject(code, message, null)
    writeQueues.remove(sessionId)?.let { queue -> synchronized(queue) { while (queue.isNotEmpty()) queue.removeFirst().promise.reject(code, message, null) } }
  }

  private fun scheduleSessionTimeout(sessionId: String) {
    val timeout = Runnable {
      sessionTimeouts.remove(sessionId)
      rejectPendingSession(sessionId, "E_GATT_TIMEOUT", "Bluetooth session setup timed out after 15s")
      closeSession(sessionId)
    }
    sessionTimeouts[sessionId] = timeout
    mainHandler.postDelayed(timeout, 15_000)
  }

  private fun cancelSessionTimeout(sessionId: String) {
    sessionTimeouts.remove(sessionId)?.let(mainHandler::removeCallbacks)
  }

  private fun recordSent(sessionId: String, packetId: String, byteCount: Int) { accountSent(sessionId, byteCount); emit(mapOf("kind" to "record-sent", "sessionId" to sessionId, "peerToken" to (sessionPeers[sessionId] ?: ""), "packetId" to packetId, "byteCount" to byteCount, "atMs" to System.currentTimeMillis())) }

  @SuppressLint("MissingPermission")
  private fun closeSession(sessionId: String) { cancelSessionTimeout(sessionId); pendingSessions.remove(sessionId)?.reject("E_SESSION_CLOSED", "Session closed before setup completed", null); failWrites(sessionId, "E_SESSION_CLOSED", "Session closed before the record was written"); try { classicSockets.remove(sessionId)?.close() } catch (_: Exception) {}; clientGatts.remove(sessionId)?.run { disconnect(); close() }; serverDevices.remove(sessionId)?.let { gattServer?.cancelConnection(it) }; closeFromNative(sessionId, "complete") }

  /**
   * Aborts a half-open session with a named cause.
   *
   * Both the pending openSession promise AND a transport error event are
   * raised: the promise unblocks the relay loop, and the event is what
   * actually reaches the user, because a rejected promise is swallowed by the
   * loop's per-peer catch.
   */
  /**
   * Rejects a pending openSession AND surfaces the cause as a transport error.
   *
   * A bare promise rejection is INVISIBLE: relay-loop catches it per peer and
   * records only "contact-failed" with no reason attached. That is what made a
   * session that connects, then dies before the inventory phase, impossible to
   * diagnose from the app log -- the failure had a cause, and nothing carried
   * it out of the native layer.
   */
  private fun rejectPendingSession(sessionId: String, code: String, message: String) {
    if (!pendingSessions.containsKey(sessionId)) return
    transportError(code, message, true)
    pendingSessions.remove(sessionId)?.reject(code, message, null)
  }

  private fun failSession(sessionId: String, code: String, message: String) {
    cancelSessionTimeout(sessionId)
    transportError(code, message, true)
    pendingSessions.remove(sessionId)?.reject(code, message, null)
    clientGatts.remove(sessionId)?.run { disconnect(); close() }
    closeFromNative(sessionId, "error")
  }
  private fun closeFromNative(sessionId: String, reason: String) { cancelSessionTimeout(sessionId); negotiatedMtu.remove(sessionId); val recordsAccepted = sessionRecordsAccepted.remove(sessionId) ?: 0; val bytesTransferred = sessionBytesTransferred.remove(sessionId) ?: 0; val peer = sessionPeers.remove(sessionId) ?: return; emit(mapOf("kind" to "session-closed", "sessionId" to sessionId, "peerToken" to peer, "reason" to reason, "recordsAccepted" to recordsAccepted, "bytesTransferred" to bytesTransferred, "atMs" to System.currentTimeMillis())) }
  private fun sessionEvent(id: String, peer: String, local: Boolean) = emit(mapOf("kind" to "session", "sessionId" to id, "peerToken" to peer, "phase" to "establish", "initiatedLocally" to local, "atMs" to System.currentTimeMillis()))
  private fun recordReceived(id: String, peer: String, bytes: ByteArray) { sessionRecordsAccepted.merge(id, 1, Int::plus); sessionBytesTransferred.merge(id, bytes.size, Int::plus); emit(mapOf("kind" to "record-received-native", "sessionId" to id, "peerToken" to peer, "transport" to if (selectedMode == "classic") "tier1-classic" else "tier1-ble", "bytesBase64" to Base64.encodeToString(bytes, Base64.NO_WRAP), "atMs" to System.currentTimeMillis())) }
  private fun accountSent(sessionId: String, bytes: Int) { sessionBytesTransferred.merge(sessionId, bytes, Int::plus) }
  private fun relayState(state: String, detail: String) = emit(mapOf("kind" to "relay-state-changed", "state" to state, "detail" to detail, "atMs" to System.currentTimeMillis()))
  private fun transportError(code: String, message: String, recoverable: Boolean) = emit(mapOf("kind" to "error", "code" to code, "message" to message, "recoverable" to recoverable, "atMs" to System.currentTimeMillis()))
  private fun emit(body: Map<String, Any?>) = sendEvent("onTransportEvent", body)

  companion object {
    const val COMPANY_ID = 0xffff; const val MAGIC = 0xd5
    /** Legacy advertising PDU budget, and the two AD elements we actually emit. */
    const val ADVERTISING_PDU_BYTES = 31
    const val FLAGS_ELEMENT_BYTES = 3
    const val MANUFACTURER_HEADER_BYTES = 4

    /**
     * MIRRORS @dsm/contracts `LINK` (packages/contracts/src/limits.ts).
     *
     * REQUIRED_ATT_MTU 247 - 3 ATT header = 244 usable = MAX_RECORD_BYTES,
     * which is the 64-byte envelope plus the 180-byte per-class payload cap.
     * That is what lets every record travel in a single GATT write with no
     * link-layer chunking layer (HD-011).
     *
     * Nothing enforces that these stay in step with the TypeScript constants:
     * tools/boundaries only scans .ts/.tsx. Change one, change both.
     */
    const val REQUIRED_ATT_MTU = 247
    const val MAX_RECORD_BYTES = 244
    val SERVICE_UUID: UUID = UUID.fromString("7d4f0000-9a1c-4b6e-8f21-3c5d7e9a1b02")
    val RX_UUID: UUID = UUID.fromString("7d4f0001-9a1c-4b6e-8f21-3c5d7e9a1b02")
    val TX_UUID: UUID = UUID.fromString("7d4f0002-9a1c-4b6e-8f21-3c5d7e9a1b02")
    val CCCD_UUID: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
  }
}
