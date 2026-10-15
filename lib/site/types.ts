export interface SiteImage { path: string; alt: string; width: number; height: number }
export interface SiteFAQ { question: string; answer: string }
export interface SiteReview {
  quote:string; author:string; sourceUrl:string; checkedAt:string;
  kind?:'quote'|'summary'; rating?:number|null; dateLabel?:string;
  platform?:string; attribution?:string; snapshotContext?:string;
}
export interface SiteService {
  id: string; title: string; summary: string; body: string; dedicatedPage: boolean;
  seoTitle: string; seoDescription: string; faqs: SiteFAQ[];
}
export type SiteSection = 'services' | 'reviews' | 'about' | 'faq' | 'contact';
export interface ClinicSiteConfig {
  version: 1;
  name: string; tagline: string;
  theme: { primary: string; accent: string; highlight: string; font: 'jakarta' | 'manrope' };
  logo: SiteImage | null; heroImage: SiteImage | null; coverImage: SiteImage | null;
  hero: { eyebrow: string; title: string; body: string };
  about: { title: string; body: string };
  location: { address: string; area: string; city: string; country: string; mapsUrl: string; embedUrl: string; latitude: number | null; longitude: number | null };
  phones: string[]; hours: string;
  socials: { label: string; url: string }[];
  rating: { value: number | null; count: number | null; checkedAt: string; sourceUrl: string };
  services: SiteService[];
  reviews: SiteReview[];
  faqs: SiteFAQ[];
  clinicians: { name: string; credentials: string }[];
  sections: { about: boolean; services: boolean; reviews: boolean; faq: boolean; contact: boolean };
  pages: { mode: 'landing' | 'multipage'; contact: boolean };
  seo: { title: string; description: string; siteUrl: string };
  form: { mode: 'email' | 'whatsapp'; formspreeId: string; whatsappNumber: string; whatsappConfirmed: boolean };
  appearance?: { heroLayout:'split'|'centered'; density:'compact'|'comfortable'; corners:'square'|'soft'|'rounded'; cards:'outlined'|'elevated' };
  sectionOrder?: SiteSection[];
}
export interface RenderOptions { mode: 'preview' | 'draft' | 'production'; basePath?: string; assetUrls?: Record<string, string> }
export type FileManifest = Record<string, string>;
