import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { icons } from '@/constants/icons';
import { mobileController } from '@/src/services/mobile-controller';
import { useAppStore } from '@/store/useAppStore';

const operatingViews = ['Mumbai Operational Region', 'Mumbai City', 'Eastern Suburbs', 'Western Suburbs', 'Mumbai Coastal Sector'];

export default function ProfileScreen() {
  const router = useRouter();
  const state = useAppStore();
  const [showViews, setShowViews] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [gatewayUrl, setGatewayUrl] = useState(state.gatewayBaseUrl);
  const [savingGateway, setSavingGateway] = useState(false);
  useEffect(() => { void mobileController.refreshOfflineMap(); }, []);

  const downloadMap = async () => {
    if (downloading) return;
    setDownloading(true);
    try { await mobileController.downloadOfflineMap(); Alert.alert('Mumbai map stored', 'The basemap is available from MapLibre persistent storage.'); }
    catch (reason) { Alert.alert('Map download failed', reason instanceof Error ? reason.message : String(reason)); }
    finally { setDownloading(false); }
  };

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    await mobileController.shutdown();
    state.setIsLoggedIn(false);
    state.setHasCompletedReadiness(false);
    router.replace('/login');
  };

  const saveGateway = async () => {
    if (savingGateway) return;
    setSavingGateway(true);
    try {
      const proven = await mobileController.configureGatewayBaseUrl(gatewayUrl);
      Alert.alert(proven ? 'Gateway connected' : 'Gateway saved', proven ? 'This phone can upload SOS locations and receive website map updates.' : gatewayUrl.trim() ? 'The address is saved, but its backend identity could not be proven yet.' : 'Gateway synchronization is disabled; Bluetooth mesh continues offline.');
    } catch (reason) { Alert.alert('Gateway not saved', reason instanceof Error ? reason.message : String(reason)); }
    finally { setSavingGateway(false); }
  };

  const progress = state.offlinePackStatus === 'ready' ? 100 : state.offlinePackProgress;
  return <SafeAreaView style={{ flex: 1, backgroundColor: '#050811' }}>
    <View style={{ minHeight: 64, paddingHorizontal: 18, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#142039' }}><Text style={{ color: '#9333EA', fontSize: 10, fontWeight: '900', letterSpacing: 2 }}>LOCAL IDENTITY + DATA</Text><Text style={{ color: '#F8FAFC', fontSize: 22, fontWeight: '900', marginTop: 1 }}>Profile</Text></View>
    <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 50 }}>
      <View style={{ minHeight: 94, marginTop: 16, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#0D1424', borderWidth: 1, borderColor: '#1B2944', borderRadius: 10 }}>
        <View style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: '#8E2339', backgroundColor: '#35101A', alignItems: 'center', justifyContent: 'center' }}><icons.user size={24} color="#FFD7E2" /></View>
        <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: '#F8FAFC', fontSize: 20, fontWeight: '900' }}>{state.userName || 'Local user'}</Text><Text style={{ color: '#7E8CA6', fontSize: 12, marginTop: 4 }}>{state.role === 'responder' ? 'Responder' : 'General Public'} · stored only on this device</Text></View>
      </View>

      <Text style={sectionLabel}>OPERATIONAL VIEW</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: showViews }} onPress={() => setShowViews((shown) => !shown)} style={commandRow}><View style={{ flex: 1 }}><Text style={rowTitle}>Area focus</Text><Text style={rowDetail}>{state.selectedRegion}</Text></View><Text style={{ color: '#00F2FE', fontSize: 18 }}>{showViews ? '↑' : '↓'}</Text></TouchableOpacity>
      {showViews && <View style={{ backgroundColor: '#0A1220', borderWidth: 1, borderTopWidth: 0, borderColor: '#1B2944', borderBottomLeftRadius: 10, borderBottomRightRadius: 10, paddingVertical: 6 }}>{operatingViews.map((view) => <TouchableOpacity key={view} accessibilityRole="radio" accessibilityState={{ selected: state.selectedRegion === view }} onPress={() => { state.setSelectedRegion(view); setShowViews(false); }} style={{ minHeight: 44, justifyContent: 'center', paddingLeft: 18 }}><Text style={{ color: state.selectedRegion === view ? '#00F2FE' : '#A9B5C9', fontSize: 14, fontWeight: state.selectedRegion === view ? '900' : '600' }}>{state.selectedRegion === view ? '●  ' : '○  '}{view}</Text></TouchableOpacity>)}</View>}

      <View style={{ marginTop: 12, padding: 14, backgroundColor: '#0D1424', borderWidth: 1, borderColor: '#1B2944', borderRadius: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><View style={{ flex: 1 }}><Text style={rowTitle}>Mumbai offline basemap</Text><Text style={rowDetail}>mumbai-v2 covers the full operational region; area focus does not change the downloaded pack.</Text></View><TouchableOpacity accessibilityRole="button" accessibilityLabel="Download or refresh Mumbai offline map" accessibilityState={{ busy: downloading }} disabled={downloading} onPress={() => void downloadMap()} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>{downloading ? <ActivityIndicator color="#00F2FE" /> : <icons.download size={22} color="#00F2FE" />}</TouchableOpacity></View>
        <View style={{ height: 3, backgroundColor: '#162038', marginTop: 14 }}><View style={{ height: 3, width: `${progress}%`, backgroundColor: state.offlinePackStatus === 'error' ? '#FF456F' : '#00E676' }} /></View>
        <Text style={{ color: '#64748B', fontSize: 11, marginTop: 7 }}>{packStatus(state.offlinePackStatus, progress)} · {formatBytes(state.offlinePackBytes)} stored</Text>
      </View>

      <View style={{ marginTop: 12, padding: 14, backgroundColor: '#0D1424', borderWidth: 1, borderColor: '#1B2944', borderRadius: 10 }}>
        <Text style={rowTitle}>Website gateway</Text><Text style={rowDetail}>Use 10.0.2.2 for the Android emulator, or this computer's LAN address for a physical phone.</Text>
        <TextInput accessibilityLabel="Coordination backend address" autoCapitalize="none" autoCorrect={false} keyboardType="url" value={gatewayUrl} onChangeText={setGatewayUrl} placeholder="http://10.0.2.2:8787" placeholderTextColor="#52617A" style={{ minHeight: 46, marginTop: 10, borderRadius: 7, borderWidth: 1, borderColor: '#263653', color: '#F8FAFC', paddingHorizontal: 12 }} />
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ busy: savingGateway }} disabled={savingGateway} onPress={() => void saveGateway()} style={{ minHeight: 44, marginTop: 9, borderRadius: 7, backgroundColor: '#087E8B', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '900' }}>{savingGateway ? 'TESTING…' : 'SAVE & TEST GATEWAY'}</Text></TouchableOpacity>
      </View>

      <Text style={sectionLabel}>SYSTEM</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <QuickCommand icon={icons.shield} title="Readiness" detail="Role and permissions" onPress={() => router.push('/readiness')} />
        <QuickCommand icon={icons.relay} title="Relay" detail="Radio and gateway" onPress={() => router.push('/relay')} />
        <QuickCommand icon={icons.history} title="Diagnostics" detail="Event ledger" onPress={() => router.push('/diagnostics')} />
        <QuickCommand icon={icons.mic} title="WavePX" detail="Acoustic receiver" onPress={() => router.push('/tier2')} />
      </View>

      <TouchableOpacity accessibilityRole="button" accessibilityState={{ busy: loggingOut }} disabled={loggingOut} onPress={() => void logout()} style={{ minHeight: 54, marginTop: 18, borderWidth: 1, borderColor: '#6D1B37', borderRadius: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}><icons.logOut size={18} color="#FF7898" /><Text style={{ color: '#FF7898', fontSize: 14, fontWeight: '900' }}>{loggingOut ? 'Stopping services…' : 'Log out on this device'}</Text></View><Text style={{ color: '#FF7898', fontSize: 18 }}>→</Text></TouchableOpacity>
    </ScrollView>
  </SafeAreaView>;
}

const sectionLabel = { color: '#64748B', fontSize: 10, fontWeight: '900' as const, letterSpacing: 1.8, marginTop: 24, marginBottom: 8 };
const commandRow = { minHeight: 64, backgroundColor: '#0D1424', borderWidth: 1, borderColor: '#1B2944', borderRadius: 10, paddingHorizontal: 14, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const };
const rowTitle = { color: '#F8FAFC', fontSize: 15, fontWeight: '900' as const };
const rowDetail = { color: '#7E8CA6', fontSize: 12, lineHeight: 17, marginTop: 3 };

function QuickCommand({ icon: Icon, title, detail, onPress }: { icon: React.ElementType; title: string; detail: string; onPress: () => void }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${title}. ${detail}`} onPress={onPress} style={{ flex: 1, minHeight: 78, backgroundColor: '#0D1424', borderWidth: 1, borderColor: '#29204A', borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}><Icon size={20} color="#A855F7" /><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={{ color: '#D8DEEA', fontSize: 10, fontWeight: '800', marginTop: 8 }}>{title}</Text></TouchableOpacity>;
}
function packStatus(status: string, progress: number) { return status === 'ready' ? 'Available offline' : status === 'downloading' ? `Downloading ${progress}%` : status === 'checking' ? 'Checking local storage' : status === 'error' ? 'Download failed' : 'Not downloaded'; }
function formatBytes(bytes: number) { return bytes ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : '0 B'; }
