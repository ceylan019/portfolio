import { identifyingExifKeys } from '../../src/lib/exif';
import { aboutProblems, sentences, wordCount, MAX_ABOUT_WORDS } from '../../src/lib/content-rules';
import { personJsonLd, serializeJsonLd } from '../../src/lib/jsonld';

describe('EXIF', () => {
  test('@REQ-PRIV-01 GPS and owner fields are identifying', () => {
    expect(identifyingExifKeys({ latitude: 43.6, longitude: -79.4, Make: 'Apple' })).toEqual(['latitude', 'longitude']);
    expect(identifyingExifKeys({ GPSLatitude: [43, 39, 1], SerialNumber: 'X1', OwnerName: 'C' })).toEqual(['GPSLatitude', 'OwnerName', 'SerialNumber']);
  });
  test('@REQ-PRIV-01 empty values and missing tags are fine', () => {
    expect(identifyingExifKeys({ Artist: '', GPSLatitude: null })).toEqual([]);
    expect(identifyingExifKeys(undefined)).toEqual([]);
    expect(identifyingExifKeys({ Make: 'Apple', Orientation: 1 })).toEqual([]);
  });
});

describe('About rules', () => {
  const tagline = 'I build test automation that teams can read, trust and keep running.';
  test('@REQ-CONTENT-03 counts words ignoring Markdown punctuation', () => {
    expect(wordCount('**Hello** there, [world](https://x.example).')).toBe(3);
    expect(wordCount('   ')).toBe(0);
  });
  test('@REQ-CONTENT-03 normalizes sentences for comparison', () => {
    expect(sentences('I BUILD test automation.  Next one here! Short.')).toEqual(['i build test automation', 'next one here']);
  });
  test('@REQ-CONTENT-03 flags About text that repeats the tagline', () => {
    const about = 'I build test automation that teams can read, trust and keep running. For five years I tested products.';
    expect(aboutProblems(about, tagline)).toEqual(['About repeats the tagline: "i build test automation that teams can read trust and keep running"']);
  });
  test('@REQ-CONTENT-03 flags About text over the word limit', () => {
    const long = Array.from({ length: MAX_ABOUT_WORDS + 1 }, () => 'word').join(' ');
    expect(aboutProblems(long, tagline)).toEqual([`About has ${MAX_ABOUT_WORDS + 1} words; the limit is ${MAX_ABOUT_WORDS}.`]);
  });
  test('@REQ-CONTENT-03 a distinct, short About passes', () => {
    expect(aboutProblems('For five years I tested web and API products in small teams.', tagline)).toEqual([]);
  });
});

describe('JSON-LD', () => {
  test('@REQ-PREV-01 builds a schema.org Person', () => {
    expect(personJsonLd({ name: 'Ceylan Akyol', jobTitle: 'QA Automation Engineer', url: 'https://s.example', image: 'https://s.example/og.png', sameAs: ['https://linkedin.example/c'] }))
      .toEqual({ '@context': 'https://schema.org', '@type': 'Person', name: 'Ceylan Akyol', jobTitle: 'QA Automation Engineer', url: 'https://s.example', image: 'https://s.example/og.png', sameAs: ['https://linkedin.example/c'] });
  });
  test('@REQ-PREV-01 serialized JSON-LD can never close its script tag', () => {
    const out = serializeJsonLd({ name: '</script><script>alert(1)</script>' });
    expect(out).not.toContain('<');
    expect(JSON.parse(out).name).toBe('</script><script>alert(1)</script>');
  });
});

// Mutation testing (Task 11).
describe('rules edge cases', () => {
  test('@REQ-PRIV-01 identifying keys are reported in sorted order', () => {
    expect(identifyingExifKeys({ latitude: 1, Artist: 'C' })).toEqual(['Artist', 'latitude']);
  });
  test('@REQ-CONTENT-03 a tagline sentence hidden in link text is still a repeat', () => {
    expect(aboutProblems('[Testing web apps well](https://example.com/about). More words here.', 'Testing web apps well.'))
      .toEqual(['About repeats the tagline: "testing web apps well"']);
  });
  test('@REQ-CONTENT-03 Markdown emphasis separates words', () => {
    expect(wordCount('**Quality**first')).toBe(2);
  });
  test('@REQ-CONTENT-03 extra spaces inside a sentence neither add words nor hide a repeat', () => {
    expect(sentences('Two  words. Three  short  words.')).toEqual(['three short words']);
    expect(aboutProblems('Build reliable software.', 'Build  reliable  software')).toHaveLength(1);
  });
  test('@REQ-CONTENT-03 exactly the word limit is allowed', () => {
    expect(aboutProblems(Array.from({ length: MAX_ABOUT_WORDS }, () => 'word').join(' '), 'Tagline goes here')).toEqual([]);
  });
});
