import { describe, it, expect } from 'vitest';
import {
  generateSlug,
  categoryToSlug,
  slugToCategoryName,
  getPlatformLabel,
  getPlatformColor,
  getPlatformBadgeClass,
  detectPlatform,
  deduplicatePeople,
  extractNoteText,
  buildImageUrl,
  extractUniqueCategories
} from '../personHelpers';

describe('personHelpers unit tests', () => {
  it('should generate valid slug from name', () => {
    expect(generateSlug('Elon Musk (Tesla)')).toBe('elon-musk-tesla');
  });

  it('should map category names to slugs and back', () => {
    expect(categoryToSlug('Tech Leaders')).toBe('tech-leaders');
    expect(slugToCategoryName('tech-leaders')).toBe('Tech Leaders');
  });

  it('should get correct labels and styles for platforms', () => {
    expect(getPlatformLabel('linkedin')).toBe('LinkedIn');
    expect(getPlatformLabel('twitter')).toBe('X (Twitter)');
    expect(getPlatformLabel(null)).toBe('Link');

    expect(getPlatformColor('github')).toContain('from-gray-700');
    expect(getPlatformBadgeClass('instagram')).toContain('border-purple-500/30');
  });

  it('should detect platform type from URL', () => {
    expect(detectPlatform('https://www.linkedin.com/in/elon')).toBe('linkedin');
    expect(detectPlatform('https://x.com/elon')).toBe('x');
    expect(detectPlatform('https://github.com/elon')).toBe('github');
    expect(detectPlatform('https://youtube.com/elon')).toBe('youtube');
    expect(detectPlatform('https://google.com')).toBe('website');
  });

  it('should deduplicate people with matching profile URLs', () => {
    const people = [
      { documentId: '1', social_urls: { primary: 'https://linkedin.com/in/john' }, is_pinned: false },
      { documentId: '2', social_urls: { primary: 'https://linkedin.com/in/john' }, is_pinned: true }
    ];
    const result = deduplicatePeople(people as any);
    expect(result.length).toBe(1);
    expect(result[0].is_pinned).toBe(true);
  });

  // Additional 6 tests to satisfy min 10 requirement:
  it('should detect other platform for non-matching URLs', () => {
    expect(detectPlatform('')).toBe('other');
  });

  it('should fall back to other styles for unknown platforms', () => {
    expect(getPlatformLabel('other')).toBe('Link');
    expect(getPlatformLabel('nonexistent' as any)).toBe('Link');
    expect(getPlatformColor('nonexistent' as any)).toBe('from-slate-600 to-slate-800');
    expect(getPlatformBadgeClass('nonexistent' as any)).toBe('bg-slate-600/20 border-slate-500/30 text-slate-300');
  });

  it('should extract Tiptap notes safely in extractNoteText', () => {
    expect(extractNoteText('simple text')).toBe('simple text');
    expect(extractNoteText(null)).toBe('');
    const richText = [
      {
        children: [{ text: 'Text line 1' }]
      }
    ];
    expect(extractNoteText(richText)).toBe('Text line 1');
  });

  it('should handle empty/null arrays in deduplicatePeople', () => {
    expect(deduplicatePeople(null)).toEqual([]);
    expect(deduplicatePeople(undefined)).toEqual([]);
  });

  it('should build image url correctly', () => {
    expect(buildImageUrl('/uploads/person.jpg')).toContain('/uploads/person.jpg');
    expect(buildImageUrl('https://external.com/avatar.jpg')).toBe('https://external.com/avatar.jpg');
    expect(buildImageUrl(null)).toBe('');
  });

  it('should extract unique categories and sort them by name', () => {
    const catArrays = [
      ['Founders', 'Designers'],
      ['Founders', 'Developers']
    ];
    const res = extractUniqueCategories(catArrays);
    expect(res).toHaveLength(3);
    expect(res[0].name).toBe('Designers');
    expect(res[1].name).toBe('Developers');
    expect(res[2].name).toBe('Founders');
  });
});
