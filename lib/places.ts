import { safeHttps } from './site/renderer.mjs';
import type { SiteReview } from './site/types';

export interface GoogleReview {
  rating?: number;
  text?: { text?: string };
  relativePublishTimeDescription?: string;
  googleMapsUri?: string;
  authorAttribution?: { displayName?: string };
}
export interface GooglePhoto { name?: string; photoUri?: string; authorAttributions?: { displayName?: string }[] }
export interface GooglePlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  internationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  websiteUri?: string;
  reviews?: GoogleReview[];
  photos?: GooglePhoto[];
}
export interface MapsFacts { name: string; address: string; phone: string; rating: number | null; reviews: number | null; mapsUrl: string }
export interface MapsPhotoRef { name: string; alt: string }

export function mapsPlaceId(url: unknown): string {
  try { const u = new URL(String(url)); return u.searchParams.get('query_place_id') || u.searchParams.get('place_id') || ''; } catch { return ''; }
}
export const mapsUrlFor = (name: string, placeId: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name || 'Clinic')}${placeId ? `&query_place_id=${encodeURIComponent(placeId)}` : ''}`;
export function placeFacts(place: GooglePlace, placeId: string, fallbackName = '', fallbackAddress = ''): MapsFacts {
  const name = place.displayName?.text || fallbackName || 'Clinic';
  return {
    name,
    address: place.formattedAddress || fallbackAddress,
    phone: typeof place.internationalPhoneNumber === 'string' ? place.internationalPhoneNumber.trim() : '',
    rating: typeof place.rating === 'number' ? place.rating : null,
    reviews: typeof place.userRatingCount === 'number' ? place.userRatingCount : null,
    mapsUrl: mapsUrlFor(name, placeId),
  };
}
export function placeReviews(place: GooglePlace, mapsUrl: string, today: string): SiteReview[] {
  return (place.reviews || []).flatMap(r => {
    const quote = (r.text?.text || '').trim();
    if (!quote) return [];
    const review: SiteReview = {
      quote: quote.slice(0, 4000),
      author: (r.authorAttribution?.displayName || 'Google reviewer').slice(0, 120),
      sourceUrl: (r.googleMapsUri && safeHttps(r.googleMapsUri)) || mapsUrl,
      checkedAt: today,
      kind: 'quote',
      platform: 'Google Maps',
      attribution: 'Google Maps review',
    };
    if (Number.isInteger(r.rating) && (r.rating as number) >= 1 && (r.rating as number) <= 5) review.rating = r.rating as number;
    if (r.relativePublishTimeDescription) review.dateLabel = String(r.relativePublishTimeDescription).slice(0, 60);
    return [review];
  }).slice(0, 5);
}
export function placePhotoRefs(place: GooglePlace): MapsPhotoRef[] {
  return (place.photos || []).slice(0, 2).flatMap(p => {
    const src = p.photoUri || p.name;
    return src ? [{ name: src, alt: `Clinic photo via Google Maps${p.authorAttributions?.[0]?.displayName ? ` · ${p.authorAttributions[0].displayName}` : ''}` }] : [];
  });
}
export interface FirecrawlPlace {
  name?: string;
  address?: string;
  phone?: string;
  rating?: number;
  reviewCount?: number;
  reviews?: { author?: string; rating?: number; text?: string; dateLabel?: string }[];
  photos?: string[];
}
// Maps a Firecrawl extraction of a Google Maps page onto the same shape the
// Places API returned, so the fact/review/photo mappers stay source-agnostic.
export function placeFromFirecrawl(data: FirecrawlPlace): GooglePlace {
  return {
    displayName: { text: typeof data.name === 'string' ? data.name : '' },
    formattedAddress: typeof data.address === 'string' ? data.address : '',
    internationalPhoneNumber: typeof data.phone === 'string' ? data.phone : '',
    rating: typeof data.rating === 'number' ? data.rating : undefined,
    userRatingCount: typeof data.reviewCount === 'number' ? data.reviewCount : undefined,
    reviews: (data.reviews || []).map(r => ({ rating: typeof r.rating === 'number' ? r.rating : undefined, text: { text: typeof r.text === 'string' ? r.text : '' }, authorAttribution: { displayName: typeof r.author === 'string' ? r.author : '' }, relativePublishTimeDescription: typeof r.dateLabel === 'string' ? r.dateLabel : undefined })),
    photos: (data.photos || []).filter(url => typeof url === 'string' && url).slice(0, 3).map(url => ({ photoUri: url })),
  };
}
export function cleanMapsReviews(input: unknown): SiteReview[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 5).flatMap(raw => {
    if (!raw || typeof raw !== 'object') return [];
    const r = raw as Record<string, unknown>;
    const quote = typeof r.quote === 'string' ? r.quote.slice(0, 4000) : '';
    const author = typeof r.author === 'string' ? r.author.slice(0, 120) : '';
    const sourceUrl = typeof r.sourceUrl === 'string' && safeHttps(r.sourceUrl) ? r.sourceUrl : '';
    if (!quote || !author || !sourceUrl) return [];
    const review: SiteReview = { quote, author, sourceUrl, checkedAt: new Date().toISOString().slice(0, 10), kind: 'quote', platform: 'Google Maps', attribution: 'Google Maps review' };
    if (Number.isInteger(r.rating) && (r.rating as number) >= 1 && (r.rating as number) <= 5) review.rating = r.rating as number;
    if (typeof r.dateLabel === 'string' && r.dateLabel) review.dateLabel = r.dateLabel.slice(0, 60);
    return [review];
  });
}
