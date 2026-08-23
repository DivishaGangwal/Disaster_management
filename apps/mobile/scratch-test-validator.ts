import { validateSchema } from '../packages/validator/src/schemas.js';
import { MessageType } from '../packages/contracts/src/index.js';

const payload = {
  incidentId: 'df047d3b9053bb75',
  responderRef: 'd4b7914f15d2a912',
  location: { 
    source: 1, 
    latE7: 190750000 + Math.floor(Math.random() * 8000) - 4000, 
    lonE7: 728790000 + Math.floor(Math.random() * 8000) - 4000, 
    ageS: 0 
  }
};

const result = validateSchema(MessageType.RESPONDER_ACCEPTED, payload);
console.log(result);
