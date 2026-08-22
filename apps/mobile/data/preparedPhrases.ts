export interface PreparedPhrase {
  id: number;
  text: string;
  lang: string;
}

export const preparedPhrases: PreparedPhrase[] = [
  { id: 0, text: 'Need immediate rescue', lang: 'en' },
  { id: 1, text: 'Trapped under debris', lang: 'en' },
  { id: 2, text: 'Need medical help', lang: 'en' },
  { id: 3, text: 'Water rising fast', lang: 'en' },
  { id: 4, text: 'Building unstable', lang: 'en' },
  { id: 5, text: 'Fire spreading', lang: 'en' },
  { id: 6, text: 'Children with us', lang: 'en' },
  { id: 7, text: 'Cannot move', lang: 'en' },
  { id: 8, text: 'Gas leak detected', lang: 'en' },
  { id: 9, text: 'Safe but need supplies', lang: 'en' },
];
