import { createClinicConfig } from './site/renderer.mjs';
import type { Workspace } from './types';
export const OLI_ID = '00000000-0000-4000-8000-000000000001';
export function initialWorkspace(): Workspace {
  const mapsUrl='https://www.google.com/maps/search/?api=1&query=Oli+Dental+Clinic%2C+Addis+Ababa%2C+Ethiopia&query_place_id=ChIJ4QgBpN-FSxYRJ5jCJGsvjwk';
  const config = createClinicConfig({name:'OLI Dental Clinic',address:'Grace City Mall, 3rd Floor, Kenenisa Ave, Megenagna',phone:'+251942438888',mapsUrl,rating:4.9,reviews:47,checkedAt:'2026-10-07'});
  config.theme={primary:'#0C457B',accent:'#F7DC43',highlight:'#1FA8D6',font:'jakarta'};
  config.tagline='Modern dentistry, classic values';
  config.hero={eyebrow:'Dental care in Megenagna',title:'A brighter smile begins with good care.',body:'Meet OLI Dental Clinic in Grace City Mall, Megenagna. Start a conversation about dental care and your next visit.'};
  config.about={title:'Good care starts with being heard.',body:'Visit our team in Megenagna to discuss your dental care. Ask about available services, consultation arrangements and the options that may be right for you.'};
  config.location.area='Megenagna'; config.location.latitude=9.0209025; config.location.longitude=38.7969129;
  config.location.embedUrl='https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3940.4690748437993!2d38.7969129!3d9.0209025!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x164b85dfa40108e1%3A0x98f2f6b24c29827!2sOli%20Dental%20Clinic!5e0!3m2!1sen!2set';
  config.phones=['+251942438888','+251966263667'];
  config.hours='Mon–Sat: publicly listed as 09:00–18:00. Google lists Wednesday until 18:30. Call ahead to confirm; Sunday hours are unlisted.';
  config.socials=[{label:'Instagram',url:'https://www.instagram.com/olidentalclinic/'},{label:'Facebook',url:'https://www.facebook.com/100083702157213/'},{label:'TikTok',url:'https://www.tiktok.com/@oli_dental_clinic'}];
  config.services=[['Braces & orthodontics','Ask about orthodontic care and the options the clinic offers for your smile.'],['Dental implants','Find out about implant treatment, suitability and what a consultation may involve.'],['Zirconia restorations','Talk with the clinic about zirconia restoration options and the care you need.']].map(([title,summary],i)=>({id:['orthodontics','dental-implants','zirconia-restorations'][i],title,summary,body:summary,dedicatedPage:false,seoTitle:'',seoDescription:'',faqs:[]}));
  config.reviews=[{quote:'Very professional and friendly staff. … I would recommend them for everyone.',author:'mekdelawit abi',sourceUrl:mapsUrl,checkedAt:'2026-10-07'},{quote:'Had great experience. The staff were really friendly, Dr Feven was very gentle and caring. Highly recommend!',author:'Helen Tesfay',sourceUrl:mapsUrl,checkedAt:'2026-10-07'},{quote:'Good customer service with good treatment.',author:'Tiush',sourceUrl:mapsUrl,checkedAt:'2026-10-07'}];
  config.seo.title='OLI Dental Clinic | Dental care in Megenagna, Addis Ababa';
  config.seo.description='Explore OLI Dental Clinic in Grace City Mall, Megenagna, Addis Ababa. Ask about orthodontics, implants and zirconia restorations, find directions and contact the team.';
  return {
    prospects:[{id:OLI_ID,source:{name:'Oli Dental Clinic',address:'Kenenisa Ave, Addis Ababa, Ethiopia',phone:'+251942438888',email:'',socialNotes:'Facebook account referenced by directory',socialUrls:[],rating:4.9,reviews:47,websiteStatus:'No standalone website found',seoPresence:'Weak — Maps/directories/social only',aeoPresence:'No owned answer-content presence found',confidence:'High',evidence:'Directory lists Facebook only; no standalone owned website found',mapsUrl,verificationSource:'https://www.dentists10.com/ET/Addis-Ababa/100424892772581/Oli-Dental-Clinic',score:98.8,priority:'High',importedStage:'Not contacted',notes:''},provenance:{filename:'OLI research example',sheet:'Existing website',row:0,researchDate:'2026-09-20',importedAt:'2026-10-10T00:00:00.000Z',raw:{}},overrides:{},notes:'Clinic responded on TikTok and requested a proposal. Confirm details with the clinic before launch.',stage:'Proposal requested',shortlisted:true,recheck:{status:'Not rechecked',url:'',checkedAt:''}}],
    projects:[{id:'00000000-0000-4000-8000-000000000002',prospectId:OLI_ID,slug:'oli-dental-clinic',config,updatedAt:'2026-10-10T00:00:00.000Z',publishedReleaseId:null,publishedConfigHash:null}],assets:[],releases:[]
  };
}
