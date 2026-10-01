import { expect, it } from 'vitest';
import * as wire from '../../shared/explorersContract';
import { editableOwnerRecommendationSchema } from '../../shared/explorersOwnerContentContract';
import { publicRecommendationDetailSchema } from '../../shared/explorersPublicContentContract';

it('normalizes manual titles without merging identity and counts Unicode code points',()=>{
 const schema=(wire as any).resolveManualEntitySchema;
 expect(schema).toBeDefined();
 for(const category of ['books','movies','games','apps','products','people'])expect(schema.parse({kind:'manual',category,details:{title:'  😀  A  '}}).details.title).toBe('😀  A');
 expect(schema.parse({kind:'manual',category:'books',details:{title:'😀'.repeat(500)}}).details.title).toHaveLength(1000);
 for(const title of ['', '  ',null,'😀'.repeat(501),'A\nB','A\tB','A\u007fB','A\ud800B'])expect(schema.safeParse({kind:'manual',category:'books',details:{title}}).success).toBe(false);
 for(const extra of [{entityId:'x'},{accountId:'x'},{provider:'google_books'}])expect(schema.safeParse({kind:'manual',category:'books',details:{title:'A'},...extra}).success).toBe(false);
 expect(schema.safeParse({kind:'manual',category:'places',details:{title:'A'}}).success).toBe(false);
 expect(schema.safeParse({kind:'manual',category:'books',details:{title:'A',facts:{}}}).success).toBe(false);
});
it('distinguishes sparse absence, whole reset and explicit null while rejecting invalid overrides',()=>{
 const base={expectedRevision:1};
 for(const displayOverrides of [{},{title:null},{title:'  😀  '}]){
  const parsed=wire.updateRecommendationSchema.parse({...base,displayOverrides}) as any;
  expect(parsed.displayOverrides).toEqual(displayOverrides.title==='  😀  '?{title:'😀'}:displayOverrides);
 }
 for(const displayOverrides of [null,{title:''},{title:'\n'},{title:'A\u0000B'},{title:'\udfff'},{title:'😀'.repeat(501)},{title:'A',accountId:'x'}])expect(wire.updateRecommendationSchema.safeParse({...base,displayOverrides}).success).toBe(false);
 for(const title of [' A ','A\nB','A\ud800B'])expect(wire.displayOverridesReadSchema.safeParse({title}).success).toBe(false);
});
it('keeps compatible canonical reads while allowing nullable effective public presentation',()=>{
 const entity={id:'00000000-0000-4000-8000-000000000001',kind:'book',title:'😀'.repeat(500)};
 expect(wire.entityCoreDtoSchema.safeParse(entity).success).toBe(true);
 expect(wire.entityCoreDtoSchema.safeParse({...entity,title:'Old\nTitle'}).success).toBe(true);
 expect(wire.entityCoreDtoSchema.parse({...entity,title:'  Old\nTitle  '}).title).toBe('Old\nTitle');
 const dto={version:'explorers-public-content/v1',recommendation:{id:entity.id,kind:'book',title:null,userRating:null,note:null}};
 expect(publicRecommendationDetailSchema.safeParse(dto).success).toBe(true);
 expect(publicRecommendationDetailSchema.safeParse({...dto,recommendation:{...dto.recommendation,title:'😀'.repeat(501)}}).success).toBe(false);
 expect(editableOwnerRecommendationSchema.innerType().shape).toHaveProperty('displayTitle');
});
