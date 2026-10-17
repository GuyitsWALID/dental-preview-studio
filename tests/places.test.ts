import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapsPlaceId, mapsUrlFor, placeFacts, placeReviews, placePhotoRefs, placeFromFirecrawl, cleanMapsReviews } from '../lib/places';

test('a Google Maps URL yields its place id and a canonical dedupe URL', () => {
  assert.equal(mapsPlaceId('https://www.google.com/maps/place/Cedar/@9,38,17z/data=!3m1!4b1?query_place_id=ChIJ123'), 'ChIJ123');
  assert.equal(mapsPlaceId('https://maps.google.com/?place_id=ChIJ456'), 'ChIJ456');
  assert.equal(mapsPlaceId('not a url'), '');
  assert.equal(mapsPlaceId('https://www.google.com/maps/place/Cedar'), '');
  assert.ok(mapsUrlFor('Cedar Dental', 'ChIJ123').includes('query_place_id=ChIJ123'));
});

test('listing facts map to clinic fields with nulls preserved and Maps URL rebuilt', () => {
  const facts = placeFacts({ displayName: { text: 'Cedar Dental' }, formattedAddress: 'Bole, Addis Ababa', internationalPhoneNumber: '+251911234567', rating: 4.7, userRatingCount: 213 }, 'ChIJ123');
  assert.deepEqual(facts, { name: 'Cedar Dental', address: 'Bole, Addis Ababa', phone: '+251911234567', rating: 4.7, reviews: 213, mapsUrl: mapsUrlFor('Cedar Dental', 'ChIJ123') });
  const bare = placeFacts({}, '', 'Fallback Name', 'Fallback Address');
  assert.equal(bare.name, 'Fallback Name'); assert.equal(bare.address, 'Fallback Address');
  assert.equal(bare.rating, null); assert.equal(bare.reviews, null); assert.equal(bare.phone, '');
});

test('only text reviews are kept, capped at five, with integer ratings and Google attribution', () => {
  const reviews = placeReviews({ reviews: [
    { rating: 5, text: { text: '  Excellent care  ' }, authorAttribution: { displayName: 'Sara' }, googleMapsUri: 'https://www.google.com/maps/review/1', relativePublishTimeDescription: '2 months ago' },
    { rating: 4, text: {} },
    { rating: 9, text: { text: 'Out of range rating is dropped' } },
    { rating: 3.5, text: { text: 'Fractional rating is dropped' } },
  ] }, 'https://www.google.com/maps/place/x', '2026-10-17');
  assert.equal(reviews.length, 3);
  assert.equal(reviews[0].quote, 'Excellent care'); assert.equal(reviews[0].author, 'Sara');
  assert.equal(reviews[0].rating, 5); assert.equal(reviews[0].platform, 'Google Maps'); assert.equal(reviews[0].checkedAt, '2026-10-17');
  assert.equal(reviews[0].dateLabel, '2 months ago'); assert.equal(reviews[0].sourceUrl, 'https://www.google.com/maps/review/1');
  assert.equal(reviews[1].rating, undefined); assert.equal(reviews[1].sourceUrl, 'https://www.google.com/maps/place/x');
  assert.equal(reviews[2].rating, undefined);
  const many = placeReviews({ reviews: Array.from({ length: 8 }, () => ({ text: { text: 'ok' }, authorAttribution: { displayName: 'X' } })) }, 'https://www.google.com/maps', '2026-10-17');
  assert.equal(many.length, 5);
});

test('photo references keep two usable entries with author attribution', () => {
  const refs = placePhotoRefs({ photos: [{ name: 'places/a/photos/1', authorAttributions: [{ displayName: 'Ann' }] }, { name: 'places/a/photos/2' }, { name: 'places/a/photos/3' }, {}] });
  assert.equal(refs.length, 2);
  assert.deepEqual(refs[0], { name: 'places/a/photos/1', alt: 'Clinic photo via Google Maps · Ann' });
  assert.equal(refs[1].alt, 'Clinic photo via Google Maps');
});

test('photo references prefer a direct photo URL and keep two usable entries', () => {
  const refs = placePhotoRefs({ photos: [{ photoUri: 'https://lh3.googleusercontent.com/p/a=w360' }, { name: 'places/a/photos/2' }, {}] });
  assert.equal(refs.length, 2);
  assert.deepEqual(refs[0], { name: 'https://lh3.googleusercontent.com/p/a=w360', alt: 'Clinic photo via Google Maps' });
  assert.equal(refs[1].name, 'places/a/photos/2');
});

test('a Firecrawl extraction maps onto the same place shape', () => {
  const place = placeFromFirecrawl({
    name: 'Oli Dental Clinic', address: 'Kenenisa Ave, Addis Ababa', phone: '+251 94 243 8888', rating: 4.9, reviewCount: 47,
    reviews: [{ author: 'Tiush', rating: 5, text: 'Good customer service', dateLabel: '7 months ago' }, { author: 'Sara', text: '' }],
    photos: ['https://lh3.googleusercontent.com/p/a=w360', 'https://lh5.googleusercontent.com/p/b=w360', ''],
  });
  const facts = placeFacts(place, 'ChIJ123');
  assert.equal(facts.name, 'Oli Dental Clinic'); assert.equal(facts.phone, '+251 94 243 8888'); assert.equal(facts.rating, 4.9); assert.equal(facts.reviews, 47);
  const reviews = placeReviews(place, facts.mapsUrl, '2026-10-17');
  assert.equal(reviews.length, 1); assert.equal(reviews[0].quote, 'Good customer service'); assert.equal(reviews[0].author, 'Tiush'); assert.equal(reviews[0].rating, 5); assert.equal(reviews[0].dateLabel, '7 months ago');
  assert.equal(placePhotoRefs(place).length, 2);
  const bare = placeFromFirecrawl({});
  assert.equal(bare.displayName?.text, ''); assert.equal(bare.rating, undefined); assert.deepEqual(bare.photos, []);
});

test('client-supplied review payloads are sanitized and incomplete rows rejected', () => {
  const cleaned = cleanMapsReviews([
    { quote: 'Great visit', author: 'Sara', sourceUrl: 'https://www.google.com/maps/review/1', rating: 5, dateLabel: '2 months ago' },
    { quote: 'Missing author', sourceUrl: 'https://www.google.com/maps/review/2' },
    { quote: 'Bad url', author: 'X', sourceUrl: 'javascript:alert(1)' },
    { quote: '', author: 'Y', sourceUrl: 'https://www.google.com/maps/review/3' },
  ]);
  assert.equal(cleaned.length, 1);
  assert.equal(cleaned[0].quote, 'Great visit'); assert.equal(cleaned[0].rating, 5);
  assert.equal(cleaned[0].kind, 'quote'); assert.equal(cleaned[0].platform, 'Google Maps');
  assert.deepEqual(cleanMapsReviews(undefined), []);
});
