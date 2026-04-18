import fc from 'fast-check';

/**
 * All 50 US state codes + DC
 */
export const US_STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC',
] as const;

export type USStateCode = (typeof US_STATE_CODES)[number];

export const TRAINING_STYLES = ['gi', 'no-gi', 'both', 'wrestling', 'judo'] as const;
export type TrainingStyle = (typeof TRAINING_STYLES)[number];

export const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced', 'all-levels'] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const BELT_RANKS = ['white', 'blue', 'purple', 'brown', 'black'] as const;
export type BeltRank = (typeof BELT_RANKS)[number];

// --- Arbitraries ---

/** Valid email addresses */
export const validEmailArb = fc
  .tuple(
    fc.stringMatching(/^[a-z][a-z0-9]{1,10}$/),
    fc.stringMatching(/^[a-z][a-z0-9]{1,8}$/),
    fc.constantFrom('com', 'org', 'net', 'edu'),
  )
  .map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

/** Display names: 1-50 printable characters, no leading/trailing whitespace */
export const displayNameArb = fc
  .stringMatching(/^[A-Za-z][A-Za-z0-9 _-]{0,49}$/)
  .filter((s) => s.trim().length > 0);

/** Valid passwords: 8+ characters */
export const validPasswordArb = fc
  .string({ minLength: 8, maxLength: 72 })
  .filter((s) => s.length >= 8);

/** Invalid passwords: fewer than 8 characters */
export const invalidPasswordArb = fc.string({ minLength: 0, maxLength: 7 });

/** Valid US state code */
export const usStateCodeArb = fc.constantFrom(...US_STATE_CODES);

/** Invalid US state code — 2-letter string that is NOT a valid state */
export const invalidUsStateCodeArb = fc
  .stringMatching(/^[A-Z]{2}$/)
  .filter((s) => !(US_STATE_CODES as readonly string[]).includes(s));

/** Latitude: -90 to 90 */
export const latitudeArb = fc.double({ min: -90, max: 90, noNaN: true });

/** Longitude: -180 to 180 */
export const longitudeArb = fc.double({ min: -180, max: 180, noNaN: true });

/** Coordinate pair [lat, lng] */
export const coordinatesArb = fc.tuple(latitudeArb, longitudeArb);

/** Training style */
export const trainingStyleArb = fc.constantFrom(...TRAINING_STYLES);

/** Skill level */
export const skillLevelArb = fc.constantFrom(...SKILL_LEVELS);

/** Belt rank */
export const beltRankArb = fc.constantFrom(...BELT_RANKS);

/** Rating 1-5 */
export const ratingArb = fc.integer({ min: 1, max: 5 });

/** Price in cents (0 to 50000 = $0 to $500) */
export const priceArb = fc.integer({ min: 0, max: 50000 });

/** Capacity (1 to 100) */
export const capacityArb = fc.integer({ min: 1, max: 100 });
