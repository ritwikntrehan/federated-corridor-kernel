import { Registry } from './kernel';
import { openAlexClinicalTrialsCorridor } from './corridors/openalex-clinicaltrials';
import { openAlexReporterCorridor } from './corridors/openalex-reporter';

export function createRegistry() { return new Registry().register(openAlexReporterCorridor).register(openAlexClinicalTrialsCorridor); }
