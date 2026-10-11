import { describe, expect, it } from 'vitest';
import { formatPageRanges, parsePageRanges, rangesForFilename } from './pageRanges';

describe('parsePageRanges', () => {
  const ok = (input: string, count = 12) => {
    const r = parsePageRanges(input, count);
    if (!r.ok) throw new Error(`atteso ok per "${input}": ${JSON.stringify(r.error)}`);
    return r.pages;
  };
  const err = (input: string, count = 12) => {
    const r = parsePageRanges(input, count);
    if (r.ok) throw new Error(`atteso errore per "${input}"`);
    return r.error;
  };

  it('pagine singole e intervalli', () => {
    expect(ok('1-3, 5, 8-10')).toEqual([1, 2, 3, 5, 8, 9, 10]);
    expect(ok('7')).toEqual([7]);
    expect(ok('2,4,6')).toEqual([2, 4, 6]);
  });

  it('spazi, separatori e trattini tipografici', () => {
    expect(ok('  1 - 3 ;5 ')).toEqual([1, 2, 3, 5]);
    expect(ok('1–3')).toEqual([1, 2, 3]);
    expect(ok('1—2')).toEqual([1, 2]);
  });

  it('intervalli aperti', () => {
    expect(ok('-3')).toEqual([1, 2, 3]);
    expect(ok('10-')).toEqual([10, 11, 12]);
  });

  it('duplicati e sovrapposizioni vengono uniti e ordinati', () => {
    expect(ok('5, 1-3, 2, 3-4')).toEqual([1, 2, 3, 4, 5]);
  });

  it('stringa vuota o virgole in sospeso (mentre si scrive)', () => {
    expect(ok('')).toEqual([]);
    expect(ok('1, ')).toEqual([1]);
    expect(ok(',,')).toEqual([]);
  });

  it('errori chiari', () => {
    expect(err('abc')).toMatchObject({ code: 'invalid', token: 'abc' });
    expect(err('1-2-3')).toMatchObject({ code: 'invalid' });
    expect(err('-')).toMatchObject({ code: 'invalid' });
    expect(err('0')).toMatchObject({ code: 'zero' });
    expect(err('14')).toMatchObject({ code: 'out_of_range', page: 14, max: 12 });
    expect(err('3-20')).toMatchObject({ code: 'out_of_range', page: 20 });
    expect(err('5-3')).toMatchObject({ code: 'reversed', suggestion: '3-5' });
  });
});

describe('formatPageRanges', () => {
  it('compatta le sequenze', () => {
    expect(formatPageRanges([1, 2, 3, 5, 8, 9, 10])).toBe('1-3, 5, 8-10');
    expect(formatPageRanges([4])).toBe('4');
    expect(formatPageRanges([])).toBe('');
    expect(formatPageRanges([3, 1, 2, 2])).toBe('1-3');
  });

  it('andata e ritorno con il parser', () => {
    const pages = [1, 2, 4, 6, 7, 8, 12];
    const r = parsePageRanges(formatPageRanges(pages), 12);
    expect(r.ok && r.pages).toEqual(pages);
  });
});

describe('rangesForFilename', () => {
  it('produce un suffisso sicuro', () => {
    expect(rangesForFilename([1, 2, 3, 5])).toBe('1-3_5');
  });
  it('tronca i suffissi troppo lunghi', () => {
    const many = Array.from({ length: 60 }, (_, i) => i * 2 + 1);
    const s = rangesForFilename(many);
    expect(s.length).toBeLessThanOrEqual(44);
    expect(s.endsWith('_etc')).toBe(true);
  });
});
