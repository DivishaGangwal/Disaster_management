import React, { useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, MapPin, Send } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { mobileController } from '@/src/services/mobile-controller';
import { useAppStore } from '@/store/useAppStore';

export default function MeshChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ peerToken?: string }>();
  const fallbackPeer = useAppStore((state) => state.selectedPeerToken);
  const allMessages = useAppStore((state) => state.meshChatMessages);
  const runtimePeers = useAppStore((state) => state.runtimePeers);
  const setRuntimeError = useAppStore((state) => state.setRuntimeError);
  const setFocusMapObjectId = useAppStore((state) => state.setFocusMapObjectId);
  const peerToken = typeof params.peerToken === 'string' ? params.peerToken : fallbackPeer ?? '';
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const messages = useMemo(() => allMessages.filter((message) => message.senderNodeToken === peerToken || message.recipientNodeToken === peerToken), [allMessages, peerToken]);
  const peer = runtimePeers.find((item) => item.peerToken === peerToken);
  const peerName = [...messages].reverse().find((message) => !message.outgoing && message.senderLabel)?.senderLabel;

  const send = async () => {
    if (sending || !draft.trim()) return;
    setSending(true);
    try {
      await mobileController.sendMeshChat(peerToken, draft);
      setDraft('');
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    } catch (reason) {
      setRuntimeError(reason instanceof Error ? reason.message : String(reason));
    } finally { setSending(false); }
  };

  const shareLocation = async () => {
    if (sending) return;
    setSending(true);
    try {
      await mobileController.sendMeshLocation(peerToken);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    } catch (reason) {
      Alert.alert('Location not shared', reason instanceof Error ? reason.message : String(reason));
    } finally { setSending(false); }
  };

  const openSharedLocation = (senderNodeToken: string) => {
    setFocusMapObjectId(`PEER-${senderNodeToken}`);
    router.push('/(tabs)/map');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#050811' }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#142039' }}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><ArrowLeft size={22} color="#F8FAFC" /></TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 6 }}><Text style={{ color: '#F8FAFC', fontSize: 17, fontWeight: '900' }}>{peerName ?? `Mesh peer ${shortToken(peerToken)}`}</Text><Text style={{ color: peer ? '#00F2FE' : '#FFB300', fontSize: 11, marginTop: 2 }}>{peerName ? `Mesh ID ${shortToken(peerToken)} · ` : ''}{peer ? 'Recently reachable by Bluetooth' : 'Offline · will relay when a route appears'}</Text></View>
        </View>
        <View style={{ paddingHorizontal: 16, paddingVertical: 9, backgroundColor: 'rgba(255,179,0,.08)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,179,0,.2)' }}><Text style={{ color: '#D6A942', fontSize: 10, lineHeight: 15 }}>Prototype mesh chat is stored and relayed offline, but messages are not end-to-end encrypted. Do not send secrets.</Text></View>
        <ScrollView ref={scrollRef} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })} contentContainerStyle={{ padding: 16, flexGrow: 1, justifyContent: 'flex-end' }}>
          {messages.length === 0 && <Text style={{ color: '#64748B', textAlign: 'center', marginBottom: 24 }}>No messages yet. The first message is saved on this phone and carried across the mesh.</Text>}
          {messages.map((message) => (
            <View key={message.packetId} style={{ maxWidth: '82%', alignSelf: message.outgoing ? 'flex-end' : 'flex-start', backgroundColor: message.outgoing ? '#5B21B6' : '#111B2E', borderWidth: 1, borderColor: message.outgoing ? '#7C3AED' : '#223251', borderRadius: 14, paddingHorizontal: 13, paddingVertical: 10, marginBottom: 9 }}>
              {!message.outgoing && <Text style={{ color: '#00F2FE', fontSize: 10, fontWeight: '800', marginBottom: 4 }}>{message.senderLabel ?? `Peer ${shortToken(message.senderNodeToken)}`}</Text>}
              <Text style={{ color: '#F8FAFC', fontSize: 14, lineHeight: 20 }}>{message.text}</Text>
              {message.location && <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Open ${message.senderLabel ?? 'shared'} location on map`} onPress={() => openSharedLocation(message.senderNodeToken)} style={{ marginTop: 9, minHeight: 38, borderRadius: 9, backgroundColor: 'rgba(0,242,254,.12)', borderWidth: 1, borderColor: 'rgba(0,242,254,.35)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }}><MapPin size={15} color="#00F2FE" /><Text style={{ color: '#00F2FE', fontSize: 11, fontWeight: '900', marginLeft: 6 }}>OPEN PERSISTED MAP PIN</Text></TouchableOpacity>}
              <Text style={{ color: message.outgoing ? '#C4B5FD' : '#64748B', fontSize: 9, marginTop: 5, alignSelf: 'flex-end' }}>{message.outgoing ? 'saved to mesh' : 'received'} · {message.packetId.slice(0, 6)}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', padding: 12, borderTopWidth: 1, borderTopColor: '#142039', backgroundColor: '#070C16' }}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Share my current location" disabled={sending} onPress={() => void shareLocation()} style={{ width: 46, height: 46, borderRadius: 23, marginRight: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: sending ? '#253047' : '#12394A', borderWidth: 1, borderColor: '#00A8B5' }}><MapPin size={19} color="#00F2FE" /></TouchableOpacity>
          <TextInput accessibilityLabel="Message" value={draft} onChangeText={setDraft} placeholder="Message this person…" placeholderTextColor="#52617A" multiline maxLength={120} style={{ flex: 1, minHeight: 46, maxHeight: 120, color: '#F8FAFC', backgroundColor: '#0D1424', borderWidth: 1, borderColor: '#263653', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 }} />
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Send message" disabled={sending || !draft.trim()} onPress={send} style={{ width: 46, height: 46, borderRadius: 23, marginLeft: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: sending || !draft.trim() ? '#253047' : '#7C3AED' }}><Send size={19} color="#FFFFFF" /></TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function shortToken(token: string) { return token.length <= 8 ? token : `${token.slice(0, 4)}…${token.slice(-4)}`; }
