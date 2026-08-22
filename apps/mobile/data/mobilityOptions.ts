export type MobilityOption = {
  id: number;
  label: string;
};

export const mobilityOptions: MobilityOption[] = [
  { id: 0, label: 'Mobile' },
  { id: 1, label: 'Limited' },
  { id: 2, label: 'Immobile' },
  { id: 3, label: 'Trapped' },
  { id: 4, label: 'Unknown' },
];
