/**
 * Bundle entry. Exposes the real packages to the browser as `window.DSM`.
 * No logic lives here — this file only re-exports.
 *
 * `screenRegistry` and `appRuntime` come from apps/mobile, so the simulator
 * renders the Expo app's own screen list and its own readiness copy rather
 * than a paraphrase of them.
 */

import * as contracts from '@dsm/contracts';
import * as codec from '@dsm/codec';
import * as validator from '@dsm/validator';
import * as policy from '@dsm/policy';
import * as routing from '@dsm/routing';
import * as store from '@dsm/store';
import * as incident from '@dsm/incident';
import * as mapkit from '@dsm/mapkit';
import * as transportCore from '@dsm/transport-core';
import * as tier2 from '@dsm/tier2';
import * as gatewayClient from '@dsm/gateway-client';
import * as nodeRuntime from '@dsm/node-runtime';

import * as screenRegistry from '../../../apps/mobile/src/screens/screen-registry.ts';
import * as appRuntime from '../../../apps/mobile/src/services/app-runtime.ts';

globalThis.DSM = {
  contracts, codec, validator, policy, routing, store,
  incident, mapkit, transportCore, tier2, gatewayClient, nodeRuntime,
  mobile: { screens: screenRegistry, runtime: appRuntime },
};
