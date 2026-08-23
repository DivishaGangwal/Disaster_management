/**
 * RUNTIME CONTEXT
 *
 * The single place where AppRuntime is created and made available to the UI.
 * Screens consume useRuntime() — they never import NodeEngine, RelayLoop, or
 * any transport directly (02-...: "Direct use of platform radio APIs from
 * arbitrary screens is prohibited").
 *
 * Lifecycle:
 *   1. RuntimeProvider mounts → AppRuntime.create() with 'simulated' adapter
 *   2. Transport events → update Zustand store (peersRecentlySeen, relayState,
 *      internetState, diagnosticEvents)
 *   3. Screens call useRuntime() to get the runtime instance for commands
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppRuntime } from '../services/app-runtime';
import { useAppStore } from '../../store/useAppStore';
import { SourceClass, type LocalProfile } from '@dsm/contracts';
import { GatewaySynchronizer } from '@dsm/node-runtime';
import { HttpGatewayClient } from '@dsm/gateway-client';

interface RuntimeContextValue {
  runtime: AppRuntime | null;
  /** True while AppRuntime.create() is still running. */
  initializing: boolean;
  error: string | null;
}

const RuntimeContext = createContext<RuntimeContextValue>({
  runtime: null,
  initializing: true,
  error: null,
});

export function useRuntime(): RuntimeContextValue {
  return useContext(RuntimeContext);
}

interface RuntimeProviderProps {
  children: ReactNode;
  /** Backend URL — if provided, GatewaySynchronizer is attached. */
  backendBaseUrl?: string;
}

export function RuntimeProvider({ children, backendBaseUrl }: RuntimeProviderProps) {
  const [ctx, setCtx] = useState<RuntimeContextValue>({
    runtime: null,
    initializing: true,
    error: null,
  });

  // Ref so the cleanup function always sees the latest runtime.
  const runtimeRef = useRef<AppRuntime | null>(null);

  const {
    role,
    selectedRegion,
    setPeersRecentlySeen,
    setRelayState,
    setInternetState,
    addDiagnosticEvent,
  } = useAppStore();

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const profile: LocalProfile = {
          localUserId: `device-${Date.now()}`,
          role: role === 'responder' ? 'responder' : 'general-public',
          language: 'en',
          responderProvisionedByDemo: role === 'responder',
        };

        const runtime = await AppRuntime.create({
          profile,
          regionCode: selectedRegion,
          adapter: 'simulated',
          backendBaseUrl,
        });

        if (cancelled) return;

        runtimeRef.current = runtime;

        // ── Subscribe to transport events ──────────────────────────────────
        // Track peers seen in a 60-second sliding window.
        const recentPeerTokens = new Set<string>();
        const peerWindowId = setInterval(() => {
          recentPeerTokens.clear();
          setPeersRecentlySeen(() => 0);
        }, 60_000);

        const unsubscribe = runtime.adapter.addEventListener((event) => {
          switch (event.kind) {
            case 'peer-observed': {
              const evt = event as unknown as Record<string, unknown>;
              const token = (evt['nodeToken'] ?? evt['peerToken']) as string | undefined;
              if (token && !recentPeerTokens.has(token)) {
                recentPeerTokens.add(token);
                setPeersRecentlySeen((n: number) => n + 1);
              } else if (!token) {
                // Adapter doesn't expose peerToken — just increment.
                setPeersRecentlySeen((n: number) => n + 1);
              }
              break;
            }

            case 'relay-state-changed': {
              const stateMap: Record<string, string> = {
                'stopped': 'stopped',
                'advertising-scanning': 'active',
                'session-active': 'active',
                'starting': 'starting',
                'backing-off': 'backing-off',
                'battery-limited': 'battery-limited',
                'error-user-action-required': 'error',
                'permission-required': 'permission-required',
              };
              setRelayState((stateMap[event.state] ?? 'stopped') as Parameters<typeof setRelayState>[0]);
              break;
            }

            default:
              break;
          }
        });

        // ── Poll engine diagnostic events every 1 s ────────────────────────
        // EventSink has emit()/recent()/clear() — no subscribe().
        // We poll recent(20) and push new entries into Zustand.
        let lastEventCount = 0;
        const pollId = setInterval(() => {
          const recent = runtime.engine.events.recent(20);
          if (recent.length !== lastEventCount) {
            // New events arrived. Push the net-new ones.
            const newCount = recent.length - lastEventCount;
            if (newCount > 0) {
              // recent() returns newest-first, so take from the front.
              for (let i = Math.min(newCount, recent.length) - 1; i >= 0; i--) {
                const ev = recent[i];
                if (ev) addDiagnosticEvent(ev as unknown as Record<string, unknown>);
              }
            }
            lastEventCount = recent.length;

            // Gateway events → internetState.
            for (const ev of recent) {
              if (ev.category === 'gateway') {
                if (ev.name === 'gateway-proven') setInternetState('proven gateway');
                if (ev.name === 'gateway-lost') setInternetState('unavailable');
              }
            }
          }
        }, 1000);

        // ── Attach GatewaySynchronizer if a backend URL was given ──────────
        if (backendBaseUrl) {
          const client = new HttpGatewayClient({ baseUrl: backendBaseUrl });
          const sync = new GatewaySynchronizer({
            engine: runtime.engine,
            client,
            regionCode: selectedRegion,
            now: () => Date.now(),
          });
          runtime.attachGateway(sync);
        }

        setCtx({ runtime, initializing: false, error: null });

        // Auto-start relay silently — phone users never need to press a button.
        void runtime.startRelay();

        return () => {
          clearInterval(peerWindowId);
          clearInterval(pollId);
          unsubscribe();
          void runtime.stopRelay();
        };
      } catch (err) {
        if (!cancelled) {
          setCtx({ runtime: null, initializing: false, error: String(err) });
        }
      }
    }

    void init();

    return () => {
      cancelled = true;
    };
    // We intentionally run once on mount. Role/region changes need an app restart
    // to re-create the runtime with the new profile (simpler than hot-swapping).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <RuntimeContext.Provider value={ctx}>
      {children}
    </RuntimeContext.Provider>
  );
}
