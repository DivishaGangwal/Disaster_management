package com.dsm.radio

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

class RelayForegroundService : Service() {
  override fun onCreate() {
    super.onCreate()
    val manager = getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(NotificationChannel(CHANNEL, "Disaster relay", NotificationManager.IMPORTANCE_LOW))
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      sendBroadcast(Intent(ACTION_STOP_RELAY).setPackage(packageName))
      stopSelf()
      return START_NOT_STICKY
    }
    // Android may recreate a previously-started service after an app update.
    // Runtime Bluetooth grants do not survive every install/reinstall path,
    // and Android 14 throws from startForeground(connectedDevice) when none of
    // the qualifying permissions is currently granted. Never let that system
    // restart path crash the whole application before Readiness can ask again.
    if (!hasBluetoothRuntimePermissions()) {
      stopSelf(startId)
      return START_NOT_STICKY
    }
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    val pending = PendingIntent.getActivity(this, 1, launch, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    val stop = PendingIntent.getService(this, 2, Intent(this, RelayForegroundService::class.java).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    val notification = NotificationCompat.Builder(this, CHANNEL)
      .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
      .setContentTitle("Disaster relay is active")
      .setContentText("Nearby packet exchange is enabled")
      .setOngoing(true)
      .setContentIntent(pending)
      .addAction(0, "Stop", stop)
      .build()
    try {
      startForeground(4102, notification)
    } catch (_: SecurityException) {
      // Permission can be revoked between the check above and this call.
      stopSelf(startId)
      return START_NOT_STICKY
    }
    // The Bluetooth loop and JS event contract live in the Expo module. If the
    // process is killed, a notification-only service must not claim the relay
    // was restored; the app explicitly starts it again after state recovery.
    return START_NOT_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun hasBluetoothRuntimePermissions(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
    return listOf(
      Manifest.permission.BLUETOOTH_SCAN,
      Manifest.permission.BLUETOOTH_ADVERTISE,
      Manifest.permission.BLUETOOTH_CONNECT,
    ).all { ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED }
  }

  companion object {
    const val CHANNEL = "relay-service"
    const val ACTION_STOP = "com.dsm.radio.STOP"
    const val ACTION_STOP_RELAY = "com.dsm.radio.STOP_RELAY"
  }
}
