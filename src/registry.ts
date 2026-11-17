import { Registry } from './kernel';
import { openAlexClinicalTrialsCorridor } from './corridors/openalex-clinicaltrials';
import { openAlexReporterCorridor } from './corridors/openalex-reporter';
import { clinicalTrialsOpenAlexReverseCorridor } from './corridors/clinicaltrials-openalex-reverse';
import { nihUsptoCorridor } from './corridors/nih-uspto';
import { clinicalTrialsOpenFdaCorridor } from './corridors/clinicaltrials-openfda';

export function createRegistry() { return new Registry().register(openAlexReporterCorridor).register(openAlexClinicalTrialsCorridor).register(clinicalTrialsOpenAlexReverseCorridor).register(nihUsptoCorridor).register(clinicalTrialsOpenFdaCorridor); }
