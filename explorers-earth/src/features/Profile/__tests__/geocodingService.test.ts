import { describe, it, expect } from 'vitest';
import { createLocationGEOData } from '../../../utils/geoHelpers';

describe('Location extra GEO data checks', () => {
  it('should format location page metadata correctly', () => {
    const data = createLocationGEOData({
      locationName: 'Paris',
      recommenderName: 'Alice',
      placesCount: 5,
      topCategories: ['Cafes', 'Museums']
    });

    expect(data.pageContext).toBeDefined();
    expect(data.pageContext!.primaryEntity).toBe('Paris');
    expect(data.pageContext!.secondaryEntities).toContain('Alice');
    expect(data.pageContext!.secondaryEntities).toContain('Cafes');
  });
});
