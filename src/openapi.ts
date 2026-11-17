export const openapi = {
  openapi: '3.1.0', info: { title: 'Federated Corridor Kernel', version: '0.2.0', description: 'Typed, source-backed scholarly research corridors.' },
  servers: [{ url: '/' }], paths: {
    '/api/v1/health': { get: { operationId: 'health', responses: { '200': { description: 'Service health' } } } },
    '/api/v1/capabilities': { get: { operationId: 'capabilities', responses: { '200': { description: 'Registered countries, boundaries and corridors' } } } },
    '/api/v1/works': { get: { operationId: 'discoverWorks', parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }, { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 25 } }], responses: { '200': { description: 'Bounded OpenAlex results' } } } },
    '/api/v1/traverse/{corridorId}': { post: { operationId: 'traverseCorridor', parameters: [{ name: 'corridorId', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { required: true, content: { 'application/json': { schema: {} } } }, responses: { '200': { description: 'DiplomaticEnvelope' }, '400': { description: 'Invalid request' } } } },
    '/api/v1/investigate': { get: { operationId: 'investigateResearchChain', parameters: ['work_id', 'pmid', 'nct_id', 'project_id'].map((name) => ({ name, in: 'query', schema: { type: 'string' } })), responses: { '200': { description: 'Complete evidence graph and envelopes' } } } },
    '/api/v1/cohort': { post: { operationId: 'traverseCohort', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['origin_country', 'seed_filter'], properties: { origin_country: { enum: ['clinicaltrials.gov', 'nih-reporter', 'openalex'] }, seed_filter: { type: 'object' }, max_seeds: { type: 'integer', minimum: 1, maximum: 25, default: 15 }, corridors: { type: 'array', items: { type: 'string' } }, include_hypothesis_edges: { type: 'boolean', default: false } } } } } }, responses: { '200': { description: 'CohortResult with graph, envelopes, funnel telemetry, drop-offs, and optional continuation' }, '400': { description: 'Invalid constrained cohort query' } } } },
    '/api/v1/examples': { get: { operationId: 'examples', responses: { '200': { description: 'Verified golden identifiers' } } } }
  }
};
