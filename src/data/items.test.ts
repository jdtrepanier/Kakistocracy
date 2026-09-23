import { describe, expect, it } from 'vitest';
import { en } from '@/i18n/en';
import { ALL_ITEM_IDS, getItem } from './items';

describe('items', () => {
  it('every item has a name/description key that exists in en.ts', () => {
    for (const id of ALL_ITEM_IDS) {
      const item = getItem(id);
      expect(en[item.nameKey]).toBeDefined();
      expect(en[item.descriptionKey]).toBeDefined();
    }
  });

  it('every item has a valid placeholder colour and non-empty initials', () => {
    for (const id of ALL_ITEM_IDS) {
      const item = getItem(id);
      expect(item.placeholder.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(item.placeholder.initials.length).toBeGreaterThan(0);
    }
  });

  it('getItem returns the matching id for every entry', () => {
    for (const id of ALL_ITEM_IDS) {
      expect(getItem(id).id).toBe(id);
    }
  });
});
