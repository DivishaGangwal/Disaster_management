import * as Notifications from 'expo-notifications';
import type { AlertDecision, TransportKind } from '@dsm/contracts';

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

/**
 * Raises a notification for a packet that ARRIVED, honouring the policy engine.
 *
 * Previously this took a raw priority off the transport event and decided for
 * itself. That was wrong three ways:
 *
 *  1. It fired for SESSION-CONTROL records. INVENTORY carries priority
 *     RESPONSE_CONTROL (1), which passed the `> GENERAL_UPDATE` gate and then
 *     satisfied `<= AUTHORITY_CRITICAL`, so every inventory exchange raised a
 *     MAX-priority notification on the EMERGENCY channel -- about once a
 *     minute, with nothing actually sent.
 *  2. It bypassed the policy engine, which already answers this exact question
 *     (01-... "Notification policy") and returns `alert: 'none'` for session
 *     control.
 *  3. It did not deduplicate, against 01-...: "Duplicate packet | No repeat
 *     notification".
 *
 * Crying wolf on the emergency channel is what makes a real Level 3 alert get
 * ignored, so this now says only what the policy engine decided.
 */
export async function notifyPacketReceived(
  alert: AlertDecision,
  packetId: string,
  transport: TransportKind,
): Promise<void> {
  // 'none' is session control; 'silent' is a map update the user need not see.
  if (alert === 'none' || alert === 'silent') return;

  const urgent = alert === 'critical';
  const source =
    transport === 'tier2-mic' || transport === 'tier2-direct'
      ? 'radio broadcast'
      : transport === 'gateway'
        ? 'the coordination centre'
        : 'a nearby phone over Bluetooth';

  await Notifications.scheduleNotificationAsync({
    content: {
      title: urgent ? 'Urgent mesh update' : 'Operational mesh update',
      // "received locally" read as "created here", the opposite of the truth.
      // DEC-022: relayed and local must never blur together.
      body: `Packet ${packetId.slice(0, 8)}… received from ${source}.`,
      priority:
        urgent || alert === 'normal'
          ? Notifications.AndroidNotificationPriority.MAX
          : Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: { channelId: urgent ? 'emergency' : 'operational' },
  });
}
