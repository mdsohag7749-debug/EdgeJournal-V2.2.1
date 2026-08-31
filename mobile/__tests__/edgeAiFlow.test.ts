import { edgeAiService } from '../src/services/edgeAiService';

describe('Edge AI Request Flow & Safety Guards', () => {
  it('correctly categorizes probe states into user-facing status vocabulary', () => {
    expect(edgeAiService.interpretHealthProbe({ ok: true, enabled: true, ready: true })).toBe('READY');
    expect(edgeAiService.interpretHealthProbe({ ok: true, enabled: false, ready: false })).toBe('NOT_CONFIGURED');
    expect(edgeAiService.interpretHealthProbe({ ok: false, enabled: false, ready: false })).toBe('UNAVAILABLE');
    expect(edgeAiService.interpretHealthProbe({ ok: true, enabled: true, ready: false })).toBe('UNAVAILABLE');
  });
});
