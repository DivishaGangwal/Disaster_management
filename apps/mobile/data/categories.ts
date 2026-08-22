import { IconName } from '@/constants/icons';

export interface Category {
  id: number;
  label: string;
  iconKey: IconName;
}

export const categories: Category[] = [
  { id: 0, label: 'Fire', iconKey: 'catFire' },
  { id: 1, label: 'Flood', iconKey: 'catFlood' },
  { id: 2, label: 'Earthquake', iconKey: 'catEarthquake' },
  { id: 3, label: 'Medical', iconKey: 'catMedical' },
  { id: 4, label: 'Landslide', iconKey: 'catLandslide' },
  { id: 5, label: 'Cyclone', iconKey: 'catCyclone' },
  { id: 6, label: 'Building Collapse', iconKey: 'catBuildingCollapse' },
  { id: 7, label: 'Chemical/Gas', iconKey: 'catChemical' },
  { id: 8, label: 'Violence', iconKey: 'catViolence' },
  { id: 9, label: 'Other', iconKey: 'catOther' },
];
