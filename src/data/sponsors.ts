/**
 * Allies of the Voyage — sponsor tiers.
 * PLACEHOLDER structure. Replace `name`/`logo` with real partners when supplied;
 * `logo: null` renders a wax-seal monogram placeholder.
 */

export type Ally = { name: string; logo: string | null }

export type AllyTier = {
  tier: string
  role: string
  seals: Ally[]
}

export const allies: AllyTier[] = [
  {
    tier: 'Title Partner',
    role: 'Flagship of the fleet',
    seals: [{ name: 'Your Brand Here', logo: null }],
  },
  {
    tier: 'Powered By',
    role: 'The wind in our sails',
    seals: [
      { name: 'Powered By', logo: null },
      { name: 'Co-Powered By', logo: null },
    ],
  },
  {
    tier: 'Associate Partners',
    role: 'Allied trading ports',
    seals: [
      { name: 'Banking Partner', logo: null },
      { name: 'Healthcare Partner', logo: null },
      { name: 'Food Partner', logo: null },
      { name: 'Hospitality Partner', logo: null },
      { name: 'Education Partner', logo: null },
      { name: 'Sports Partner', logo: null },
    ],
  },
]
