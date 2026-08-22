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
  private val classicSockets = ConcurrentHashMap<String, BluetoothSocket>()
  private var classicServer: BluetoothServerSocket? = null
  private var classicReceiverRegistered = false
  private var selectedMode = "ble"
  private var advertiser: BluetoothLeAdvertiser? = null
  private var scanner: BluetoothLeScanner? = null
  private var gattServer: BluetoothGattServer? = null
  private var advertisement = byteArrayOf()
  private var sessionCounter = 0

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
    AsyncFunction("startRelay") { advertisementBase64: String, mode: String -> startRelay(advertisementBase64, mode) }
    AsyncFunction("stopRelay") { stopRelay() }
    AsyncFunction("updateAdvertisement") { value: String -> advertisement = Base64.decode(value, Base64.NO_WRAP); restartAdvertising() }
    AsyncFunction("openSession") { peerToken: String, mode: String, promise: Promise -> openSession(peerToken, mode, promise) }
    AsyncFunction("closeSession") { sessionId: String -> closeSession(sessionId) }
    AsyncFunction("sendRecord") { sessionId: String, packetId: String, bytesBase64: String -> sendRecord(sessionId, packetId, Base64.decode(bytesBase64, Base64.NO_WRAP)) }
    AsyncFunction("cancelTransfer") { sessionId: String -> closeSession(sessionId) }
    OnDestroy { stopRelay() }
  }

  private fun permission(name: String): String = if (ContextCompat.checkSelfPermission(context, name) == PackageManager.PERMISSION_GRANTED) "granted" else "denied"

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
    selectedMode = mode
    advertisement = Base64.decode(base64, Base64.NO_WRAP)
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
    context.stopService(Intent(context, RelayForegroundService::class.java)); relayState("stopped", "relay stopped")
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
      if (newState == BluetoothProfile.STATE_CONNECTED) { gatt.requestMtu(247); gatt.discoverServices() }
      else if (newState == BluetoothProfile.STATE_DISCONNECTED) closeFromNative(sessionId, "peer-closed")
    }
    @SuppressLint("MissingPermission")
    override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
      val sessionId = clientGatts.entries.firstOrNull { it.value == gatt }?.key ?: return
      if (status != BluetoothGatt.GATT_SUCCESS || gatt.getService(SERVICE_UUID) == null) { pendingSessions.remove(sessionId)?.reject("E_GATT_SERVICE", "Peer does not expose the DSM service", null); closeFromNative(sessionId, "error"); return }
      pendingSessions.remove(sessionId)?.resolve(sessionId)
      sessionEvent(sessionId, sessionPeers[sessionId] ?: "", true)
    }
    override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) { receiveClient(gatt, characteristic.value) }
    override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray) { receiveClient(gatt, value) }
  }

  private val serverCallback = object : BluetoothGattServerCallback() {
    override fun onConnectionStateChange(device: BluetoothDevice, status: Int, newState: Int) {
      if (newState != BluetoothProfile.STATE_CONNECTED) return
      val peer = addressTokens[device.address] ?: device.address.replace(":", "").takeLast(8).lowercase()
      val sessionId = "ble-in-${System.currentTimeMillis()}-${++sessionCounter}"
      serverDevices[sessionId] = device; sessionPeers[sessionId] = peer; sessionEvent(sessionId, peer, false)
    }
    @SuppressLint("MissingPermission")
    override fun onCharacteristicWriteRequest(device: BluetoothDevice, requestId: Int, characteristic: BluetoothGattCharacteristic, preparedWrite: Boolean, responseNeeded: Boolean, offset: Int, value: ByteArray) {
      if (characteristic.uuid == RX_UUID && offset == 0) {
        val sessionId = serverDevices.entries.firstOrNull { it.value.address == device.address }?.key ?: return
        recordReceived(sessionId, sessionPeers[sessionId] ?: "", value)
      }
      if (responseNeeded) gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, null)
    }
  }

  private fun receiveClient(gatt: BluetoothGatt, bytes: ByteArray) {
    val sessionId = clientGatts.entries.firstOrNull { it.value == gatt }?.key ?: return
    recordReceived(sessionId, sessionPeers[sessionId] ?: "", bytes)
  }

  @SuppressLint("MissingPermission")
  private fun sendRecord(sessionId: String, packetId: String, bytes: ByteArray) {
    require(bytes.size <= 244) { "record exceeds negotiated single-write budget" }
    val classic = classicSockets[sessionId]
    if (classic != null) {
      val output = DataOutputStream(classic.outputStream)
      output.writeShort(bytes.size); output.write(bytes); output.flush()
      emit(mapOf("kind" to "record-sent", "sessionId" to sessionId, "peerToken" to (sessionPeers[sessionId] ?: ""), "packetId" to packetId, "byteCount" to bytes.size, "atMs" to System.currentTimeMillis()))
      return
    }
    val client = clientGatts[sessionId]
    if (client != null) {
      val characteristic = client.getService(SERVICE_UUID)?.getCharacteristic(RX_UUID) ?: throw IllegalStateException("GATT RX characteristic unavailable")
      if (Build.VERSION.SDK_INT >= 33) client.writeCharacteristic(characteristic, bytes, BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT)
      else { @Suppress("DEPRECATION") characteristic.value = bytes; @Suppress("DEPRECATION") client.writeCharacteristic(characteristic) }
    } else {
      val device = serverDevices[sessionId] ?: throw IllegalStateException("unknown session")
      val characteristic = gattServer?.getService(SERVICE_UUID)?.getCharacteristic(TX_UUID) ?: throw IllegalStateException("GATT TX characteristic unavailable")
      if (Build.VERSION.SDK_INT >= 33) gattServer?.notifyCharacteristicChanged(device, characteristic, false, bytes)
      else { @Suppress("DEPRECATION") characteristic.value = bytes; @Suppress("DEPRECATION") gattServer?.notifyCharacteristicChanged(device, characteristic, false) }
    }
    emit(mapOf("kind" to "record-sent", "sessionId" to sessionId, "peerToken" to (sessionPeers[sessionId] ?: ""), "packetId" to packetId, "byteCount" to bytes.size, "atMs" to System.currentTimeMillis()))
  }

  @SuppressLint("MissingPermission")
  private fun closeSession(sessionId: String) { try { classicSockets.remove(sessionId)?.close() } catch (_: Exception) {}; clientGatts.remove(sessionId)?.run { disconnect(); close() }; serverDevices.remove(sessionId)?.let { gattServer?.cancelConnection(it) }; closeFromNative(sessionId, "complete") }
  private fun closeFromNative(sessionId: String, reason: String) { val peer = sessionPeers.remove(sessionId) ?: ""; emit(mapOf("kind" to "session-closed", "sessionId" to sessionId, "peerToken" to peer, "reason" to reason, "recordsAccepted" to 0, "bytesTransferred" to 0, "atMs" to System.currentTimeMillis())) }
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
