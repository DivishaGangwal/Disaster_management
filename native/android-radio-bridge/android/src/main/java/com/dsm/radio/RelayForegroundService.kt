package com.dsm.radio

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat

class RelayForegroundService : Service() {
  override fun onCreate() {
    super.onCreate()
    val manager = getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(NotificationChannel(CHANNEL, "Disaster relay", NotificationManager.IMPORTANCE_LOW))
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) { stopSelf(); return START_NOT_STICKY }
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
    startForeground(4102, notification)
    return START_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null
  companion object { const val CHANNEL = "relay-service"; const val ACTION_STOP = "com.dsm.radio.STOP" }
}
