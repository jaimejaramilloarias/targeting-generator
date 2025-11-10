import { describe, it, beforeAll, beforeEach, expect } from 'vitest';
import { loadAppContext, getElement } from './helpers/loadApp.js';

let appContext;

function setDeterministicRandom(ctx) {
  let state = 1;
  ctx.Math.random = () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

describe('Generación y variaciones de fórmulas', () => {
  beforeAll(() => {
    const loaded = loadAppContext();
    appContext = loaded.context;
  });

  beforeEach(() => {
    getElement(appContext, 'randomComplex').checked = false;
    getElement(appContext, 'complexity').value = '40';
    getElement(appContext, 'targetMin').value = 'C3';
    getElement(appContext, 'targetMax').value = 'C6';
    getElement(appContext, 'stability').value = '100';
    setDeterministicRandom(appContext);
  });

  it('generateLine nunca produce notas consecutivas en la misma altura', () => {
    const chord = [
      appContext.noteNameToMidi('C4'),
      appContext.noteNameToMidi('E4'),
      appContext.noteNameToMidi('G4'),
    ];
    const upper = chord.map(n => n + 1);
    const result = appContext.generateLine(chord, upper, 4, 40);

    expect(Array.isArray(result.line)).toBe(true);
    expect(result.line.length).toBeGreaterThan(0);
    for(let i=1;i<result.line.length;i++){
      expect(result.line[i]).not.toBe(result.line[i-1]);
    }
  });

  it('applyVariationOnFormula mantiene el target original y evita duplicados consecutivos', () => {
    const state = {
      line: [57, 59, 62, 60, 65],
      formulaEvents: [{
        type: 1,
        length: 3,
        startIndex: 1,
        endIndex: 3,
        targetMidi: 60,
        offsets: [-1, 2, 0],
      }],
      chord: [60, 64, 67],
    };

    const updated = appContext.applyVariationOnFormula(state, 0);

    expect(updated).not.toBe(state);
    expect(updated.line).not.toBe(state.line);
    expect(updated.line.length).toBe(state.line.length);
    const segment = updated.line.slice(1, 4);
    expect(segment[segment.length-1]).toBe(60);
    for(let i=1;i<updated.line.length;i++){
      expect(updated.line[i]).not.toBe(updated.line[i-1]);
    }
    expect(updated.formulaEvents[0].length).toBe(3);
    expect(updated.formulaEvents[0].targetMidi).toBe(60);
    expect(updated.formulaEvents[0].offsets[updated.formulaEvents[0].offsets.length-1]).toBe(0);
  });

  it('limita los targets aislados y evita notas sin ligadura', () => {
    const chord = [
      appContext.noteNameToMidi('C4'),
      appContext.noteNameToMidi('E4'),
      appContext.noteNameToMidi('G4'),
    ];
    const upper = [
      appContext.noteNameToMidi('D4'),
      appContext.noteNameToMidi('F4'),
      appContext.noteNameToMidi('A4'),
    ];

    const result = appContext.generateLine(chord, upper, 6, 100);

    expect(Array.isArray(result.events)).toBe(true);
    const coveredByFormula = new Set();
    (result.formulaEvents || []).forEach(f => {
      for(let i=f.startIndex;i<=f.endIndex;i++){
        coveredByFormula.add(i);
      }
    });

    const isolatedRuns = [];
    let currentRun = 0;

    result.events.forEach(ev => {
      if(ev.kind === 'isolated'){
        expect(ev.length).toBe(1);
        expect(result.line[ev.startIndex]).toBe(ev.targetMidi);
        currentRun++;
      }else{
        if(currentRun>0){
          isolatedRuns.push(currentRun);
          currentRun=0;
        }
        expect(result.line[ev.endIndex]).toBe(ev.targetMidi);
      }

      for(let idx=ev.startIndex; idx<=ev.endIndex; idx++){
        const isFormula = coveredByFormula.has(idx);
        if(!isFormula){
          expect(ev.kind).toBe('isolated');
          expect(result.line[idx]).toBe(ev.targetMidi);
        }
      }
    });

    if(currentRun>0) isolatedRuns.push(currentRun);

    isolatedRuns.forEach(run => {
      expect(run).toBeLessThanOrEqual(2);
    });
    const doubles = isolatedRuns.filter(v => v === 2).length;
    expect(doubles).toBeLessThanOrEqual(1);
  });

  it('lineToMusicXML añade ligaduras completas y becuadros necesarios', () => {
    const fSharp = appContext.noteNameToMidi('F#4');
    const g4 = appContext.noteNameToMidi('G4');
    const fNatural = appContext.noteNameToMidi('F4');
    const e4 = appContext.noteNameToMidi('E4');

    const line = [fSharp, g4, fNatural, e4];
    const formulaEvents = [{
      startIndex: 0,
      endIndex: 2,
      length: 3,
      targetMidi: fNatural,
      type: 1,
      offsets: [-1, 1, 0],
    }];

    const xml = appContext.lineToMusicXML(line, 'Test', 'G', formulaEvents);

    const starts = (xml.match(/<slur type="start"/g) || []).length;
    const stops = (xml.match(/<slur type="stop"/g) || []).length;
    expect(starts).toBe(1);
    expect(stops).toBe(1);
    expect(xml).toContain('<accidental>sharp</accidental>');
    expect(xml).toContain('<accidental>natural</accidental>');
  });
});
