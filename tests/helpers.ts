import openalex from '../fixtures/openalex-W4304757292.sanitized.json';
import study from '../fixtures/clinicaltrials-NCT01206062.sanitized.json';
import projects from '../fixtures/reporter-R01HL136679.sanitized.json';
import publications from '../fixtures/reporter-publications-36223105.sanitized.json';

export { openalex, study, projects, publications };
export function fixtureFetch(overrides: { fail?: string; wrongTrial?: boolean } = {}) {
  const calls: string[] = [];
  const fn: typeof fetch = async (input, init) => {
    const url = String(input); calls.push(url);
    if (overrides.fail && url.includes(overrides.fail)) return new Response('upstream unavailable', { status: 503 });
    if (url.includes('api.openalex.org/works/')) return Response.json(openalex);
    if (url.includes('api.openalex.org/works?')) return Response.json({ results: [openalex] });
    if (url.includes('clinicaltrials.gov/api/v2/studies?')) {
      const record = overrides.wrongTrial ? { ...study, protocolSection: { ...study.protocolSection, referencesModule: { references: [{ pmid: '99999999', type: 'RESULT' }] } } } : study;
      return Response.json({ studies: [record] });
    }
    if (url.includes('clinicaltrials.gov/api/v2/studies/')) return Response.json(study);
    if (url.includes('api.reporter.nih.gov/v2/projects/search')) return Response.json(projects);
    if (url.includes('api.reporter.nih.gov/v2/publications/search')) return Response.json(publications);
    throw new Error(`unmocked fetch ${url} ${String(init?.body ?? '')}`);
  };
  return { fn, calls };
}
