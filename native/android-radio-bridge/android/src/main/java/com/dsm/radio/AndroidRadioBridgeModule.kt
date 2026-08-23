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
import android.os.ParcelUuid
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
  private val classicSockets = ConcurrentHashMap<String, BluetoothSocket>()
  private var classicServer: BluetoothServerSocket? = null
  private var classicReceiverRegistered = false
  private var selectedMode = "ble"
  private var advertiser: BluetoothLeAdvertiser? = null
  private var scanner: BluetoothLeScanner? = null
  private var gattServer: BluetoothGattServer? = null
  private var advertisement = byteArrayOf()
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
        "microphone" to permission(Manifest.permission.RECORD_AUDIO), "foregroundService" to "granted"
      ),
      "batteryPercent" to battery.takeIf { it in 0..100 },
      "batteryTemperatureC" to batteryTemperatureTenths?.takeIf { it != Int.MIN_VALUE }?.div(10.0),
      "batteryOptimisationRestricted" to false,
      "thermalThrottled" to thermal, "simulated" to false, "observedAtMs" to System.currentTimeMillis()
    )
  }

  @SuppressLint("MissingPermission")
  private fun startRelay(base64: String, mode: String) {
    if (!hasBluetoothRuntimePermissions()) {
      relayState("permission-required", "Grant Nearby Devices permissions before starting relay mode")
      throw SecurityException("Nearby Devices permissions are required before starting Bluetooth relay mode")
    }
    selectedMode = mode
    advertisement = Base64.decode(base64, Base64.NO_WRAP)
    registerStopReceiver()
    ContextCompat.startForegroundService(context, Intent(context, RelayForegroundService::class.java))
    relayState("starting", "$mode transport selected")
    if (mode == "classic") {
      startClassic()
      relayState("advertising-scanning", "Bluetooth Classic discovery and RFCOMM relay are active")
      return
    }
    openGattServer()
    startAdvertising()
    startScanning()
    relayState("advertising-scanning", "BLE advertising, scanning and GATT are active")
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
    sessionTimeouts.values.forEach(mainHandler::removeCallbacks); sessionTimeouts.clear(); negotiatedMtu.clear(); sessionPeers.clear(); serverDevices.clear()
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

  @SuppressLint("MissingPermission")
  private fun startAdvertising() {
    advertiser = adapter?.bluetoothLeAdvertiser ?: throw IllegalStateException("BLE advertising unavailable")
    val settings = AdvertiseSettings.Builder().setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_POWER).setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM).setConnectable(true).build()
    val data = AdvertiseData.Builder().setIncludeDeviceName(false).addServiceUuid(ParcelUuid(SERVICE_UUID)).addManufacturerData(COMPANY_ID, advertisement).build()
    advertiser?.startAdvertising(settings, data, advertiseCallback)
  }

  @SuppressLint("MissingPermission")
  private fun restartAdvertising() { if (advertiser == null) return; advertiser?.stopAdvertising(advertiseCallback); startAdvertising() }
  private val advertiseCallback = object : AdvertiseCallback() {
    override fun onStartFailure(errorCode: Int) { transportError("BLE_ADVERTISE_$errorCode", "BLE advertising failed", true) }
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
  private fun openSession(peerToken: String, mode: String, promise: Promise) {
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
        if (!gatt.requestMtu(247)) gatt.discoverServices()
      } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
        pendingSessions.remove(sessionId)?.reject("E_GATT_DISCONNECTED", "Peer disconnected before the session was ready", null)
        failWrites(sessionId, "E_GATT_DISCONNECTED", "Peer disconnected before the record was written")
        closeFromNative(sessionId, if (status == BluetoothGatt.GATT_SUCCESS) "peer-closed" else "error")
      }
    }
    @SuppressLint("MissingPermission")
    override fun onMtuChanged(gatt: BluetoothGatt, mtu: Int, status: Int) {
      val sessionId = clientGatts.entries.firstOrNull { it.value == gatt }?.key ?: return
      negotiatedMtu[sessionId] = if (status == BluetoothGatt.GATT_SUCCESS) mtu else 23
      gatt.discoverServices()
    }
    @SuppressLint("MissingPermission")
    override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
      val sessionId = clientGatts.entries.firstOrNull { it.value == gatt }?.key ?: return
      if (status != BluetoothGatt.GATT_SUCCESS || gatt.getService(SERVICE_UUID) == null) { pendingSessions.remove(sessionId)?.reject("E_GATT_SERVICE", "Peer does not expose the DSM service", null); closeFromNative(sessionId, "error"); return }
      val tx = gatt.getService(SERVICE_UUID)?.getCharacteristic(TX_UUID)
      val descriptor = tx?.getDescriptor(CCCD_UUID)
      if (tx == null || descriptor == null || !gatt.setCharacteristicNotification(tx, true)) {
        pendingSessions.remove(sessionId)?.reject("E_GATT_NOTIFY", "Peer notification channel is unavailable", null)
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
        pendingSessions.remove(sessionId)?.reject("E_GATT_NOTIFY", "Could not subscribe to the peer notification channel", null)
        closeSession(sessionId)
      }
    }
    override fun onDescriptorWrite(gatt: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) {
      if (descriptor.uuid != CCCD_UUID) return
      val sessionId = clientGatts.entries.firstOrNull { it.value == gatt }?.key ?: return
      if (status != BluetoothGatt.GATT_SUCCESS) {
        pendingSessions.remove(sessionId)?.reject("E_GATT_NOTIFY", "Peer notification subscription failed", null)
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
    override fun onCharacteristicWriteRequest(device: BluetoothDevice, requestId: Int, characteristic: BluetoothGattCharacteristic, preparedWrite: Boolean, responseNeeded: Boolean, offset: Int, value: ByteArray) {
      val accepted = characteristic.uuid == RX_UUID && !preparedWrite && offset == 0 && value.size <= ((serverDevices.entries.firstOrNull { it.value.address == device.address }?.key?.let { negotiatedMtu[it] } ?: 23) - 3)
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
    val payloadBudget = (negotiatedMtu[sessionId] ?: 23) - 3
    if (bytes.size > payloadBudget) {
      promise.reject("E_GATT_MTU", "Record is ${bytes.size} bytes but the negotiated GATT payload budget is $payloadBudget", null)
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
      pendingSessions.remove(sessionId)?.reject("E_GATT_TIMEOUT", "Bluetooth session setup timed out", null)
      closeSession(sessionId)
    }
    sessionTimeouts[sessionId] = timeout
    mainHandler.postDelayed(timeout, 15_000)
  }

  private fun cancelSessionTimeout(sessionId: String) {
    sessionTimeouts.remove(sessionId)?.let(mainHandler::removeCallbacks)
  }

  private fun recordSent(sessionId: String, packetId: String, byteCount: Int) = emit(mapOf("kind" to "record-sent", "sessionId" to sessionId, "peerToken" to (sessionPeers[sessionId] ?: ""), "packetId" to packetId, "byteCount" to byteCount, "atMs" to System.currentTimeMillis()))

  @SuppressLint("MissingPermission")
  private fun closeSession(sessionId: String) { cancelSessionTimeout(sessionId); pendingSessions.remove(sessionId)?.reject("E_SESSION_CLOSED", "Session closed before setup completed", null); failWrites(sessionId, "E_SESSION_CLOSED", "Session closed before the record was written"); try { classicSockets.remove(sessionId)?.close() } catch (_: Exception) {}; clientGatts.remove(sessionId)?.run { disconnect(); close() }; serverDevices.remove(sessionId)?.let { gattServer?.cancelConnection(it) }; closeFromNative(sessionId, "complete") }
  private fun closeFromNative(sessionId: String, reason: String) { cancelSessionTimeout(sessionId); negotiatedMtu.remove(sessionId); val peer = sessionPeers.remove(sessionId) ?: return; emit(mapOf("kind" to "session-closed", "sessionId" to sessionId, "peerToken" to peer, "reason" to reason, "recordsAccepted" to 0, "bytesTransferred" to 0, "atMs" to System.currentTimeMillis())) }
  private fun sessionEvent(id: String, peer: String, local: Boolean) = emit(mapOf("kind" to "session", "sessionId" to id, "peerToken" to peer, "phase" to "establish", "initiatedLocally" to local, "atMs" to System.currentTimeMillis()))
  private fun recordReceived(id: String, peer: String, bytes: ByteArray) = emit(mapOf("kind" to "record-received-native", "sessionId" to id, "peerToken" to peer, "transport" to if (selectedMode == "classic") "tier1-classic" else "tier1-ble", "bytesBase64" to Base64.encodeToString(bytes, Base64.NO_WRAP), "atMs" to System.currentTimeMillis()))
  private fun relayState(state: String, detail: String) = emit(mapOf("kind" to "relay-state-changed", "state" to state, "detail" to detail, "atMs" to System.currentTimeMillis()))
  private fun transportError(code: String, message: String, recoverable: Boolean) = emit(mapOf("kind" to "error", "code" to code, "message" to message, "recoverable" to recoverable, "atMs" to System.currentTimeMillis()))
  private fun emit(body: Map<String, Any?>) = sendEvent("onTransportEvent", body)

  companion object {
    const val COMPANY_ID = 0xffff; const val MAGIC = 0xd5
    val SERVICE_UUID: UUID = UUID.fromString("7d4f0000-9a1c-4b6e-8f21-3c5d7e9a1b02")
    val RX_UUID: UUID = UUID.fromString("7d4f0001-9a1c-4b6e-8f21-3c5d7e9a1b02")
    val TX_UUID: UUID = UUID.fromString("7d4f0002-9a1c-4b6e-8f21-3c5d7e9a1b02")
    val CCCD_UUID: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
  }
}
