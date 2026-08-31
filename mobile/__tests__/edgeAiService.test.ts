import { edgeAiService } from '../src/services/edgeAiService';

describe('Edge AI Client Adapter', () => {
  it('interprets health probes into safe status strings', () => {
    expect(edgeAiService.interpretHealthProbe({ ok: true, enabled: true, ready: true })).toBe('READY');
    expect(edgeAiService.interpretHealthProbe({ ok: true, enabled: false, ready: false })).toBe('NOT_CONFIGURED');
    expect(edgeAiService.interpretHealthProbe({ ok: false, enabled: false, ready: false })).toBe('UNAVAILABLE');
    expect(edgeAiService.interpretHealthProbe({ ok: true, enabled: true, ready: false })).toBe('UNAVAILABLE');
  });
});
