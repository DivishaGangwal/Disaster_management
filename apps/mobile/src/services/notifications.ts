import * as Notifications from 'expo-notifications';
import { Priority, type PriorityValue } from '@dsm/contracts';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function configureNotificationChannels() {
  await Notifications.setNotificationChannelAsync('emergency', {
    name: 'Emergency and responder updates',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 300, 150, 300],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  await Notifications.setNotificationChannelAsync('operational', {
    name: 'Operational updates',
    importance: Notifications.AndroidImportance.HIGH,
  });
  await Notifications.setNotificationChannelAsync('relay-service', {
    name: 'Relay service',
    importance: Notifications.AndroidImportance.LOW,
    sound: null,
  });
}

export async function notifyPacketReceived(priority: PriorityValue, packetId: string) {
  if (priority > Priority.GENERAL_UPDATE) return;
  const urgent = priority <= Priority.AUTHORITY_CRITICAL;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: urgent ? 'Urgent mesh update' : 'Operational mesh update',
      body: `Validated packet ${packetId.slice(0, 8)}… was received locally.`,
      priority: urgent
        ? Notifications.AndroidNotificationPriority.MAX
        : Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: { channelId: urgent ? 'emergency' : 'operational' },
  });
}
