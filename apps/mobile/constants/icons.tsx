import React from 'react';
import {
  MapPin,
  MapPinOff,
  Radio,
  Bluetooth,
  BluetoothOff,
  Wifi,
  WifiOff,
  AlertTriangle,
  Siren,
  Battery,
  CheckCircle2,
  XCircle,
  User,
  Shield,
  Ambulance,
  Mic,
  MicOff,
  ArrowRight,
  ArrowLeft,
  Home,
  Map,
  MoreHorizontal,
  Edit3,
  AlertCircle,
  Bell,
  Tent,
  Hospital,
  Users,
  Check,
  X,
  Car,
  Flag,
  Navigation,
  Utensils,
  Play,
  Square,
  Globe,
  History,
  Megaphone,
  Layers,
  Package,
  Download,
  Filter,
  List,
  ChevronDown,
  ChevronUp,
  FileText,
  ClipboardList,
  LucideProps,
} from 'lucide-react-native';

import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

type MaterialIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function createVectorIcon(iconName: MaterialIconName) {
  return function VectorIcon({ size = 24, color = '#E8E8E8', style }: LucideProps) {
    const numSize = typeof size === 'number' ? size : 24;
    return <MaterialCommunityIcons name={iconName} size={numSize} color={color} style={style} />;
  };
}

export const icons = {
  // Navigation & Core
  home: Home,
  map: Map,
  relay: Radio,
  more: MoreHorizontal,
  arrowLeft: ArrowLeft,
  arrowRight: ArrowRight,
  chevronDown: ChevronDown,
  chevronUp: ChevronUp,

  // Status & Connectivity
  location: MapPin,
  locationOff: MapPinOff,
  bluetoothOn: Bluetooth,
  bluetoothOff: BluetoothOff,
  internetOn: Wifi,
  internetOff: WifiOff,
  battery: Battery,
  success: CheckCircle2,
  cancel: XCircle,
  check: Check,
  close: X,
  mic: Mic,
  micOff: MicOff,

  // Emergency & SOS
  alert: AlertTriangle,
  sos: Siren,
  alertCircle: AlertCircle,
  bell: Bell,

  // Roles & People
  user: User,
  responder: Ambulance,
  shield: Shield,
  users: Users,

  // Actions
  edit: Edit3,
  play: Play,
  stop: Square,
  globe: Globe,
  download: Download,
  filter: Filter,
  list: List,
  car: Car,
  flag: Flag,
  navigation: Navigation,
  fileText: FileText,
  clipboardList: ClipboardList,

  // Resource / Infrastructure
  hospital: Hospital,
  shelter: Tent,
  food: Utensils,
  history: History,
  megaphone: Megaphone,
  layers: Layers,
  package: Package,

  // Category Icons (MaterialCommunityIcons fallbacks)
  catFire: createVectorIcon('fire'),
  catFlood: createVectorIcon('water-alert'),
  catEarthquake: createVectorIcon('image-filter-hdr'),
  catMedical: createVectorIcon('medical-bag'),
  catLandslide: createVectorIcon('image-filter-hdr'),
  catCyclone: createVectorIcon('weather-hurricane'),
  catBuildingCollapse: createVectorIcon('office-building'),
  catChemical: createVectorIcon('biohazard'),
  catViolence: createVectorIcon('shield-alert'),
  catOther: createVectorIcon('alert-decagram'),
} as const;

export type IconName = keyof typeof icons;
