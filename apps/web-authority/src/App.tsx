import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { DEPLOYMENT, TIME, type CampaignState } from '@dsm/contracts';
import { e7ToFloat, floatToE7 } from './coordinates';
import { api, type CampaignDraftInput } from './api';
import { decodeBase64, encodeBase64, Tier2AudioLink } from './audio-link';
import { OperationsMap } from './OperationsMap';
import { PublishWorkspace } from './PublishWorkspace';
import { DataInspector } from './DataInspector';
import { isCentre, isOperationallyUsable, operationalVerdict } from './operational-status';
import type { Campaign, DecodedMapOperation, GatewayAudit, Incident, OperatorSession, Overview, PacketStreamItem, RegionalRecord, Responder, SectionKey } from './types';
import { selectWavePxCampaign, wavePxCampaigns } from './wavepx-selection';

const NAV: readonly { key: SectionKey; label: string; note: string }[] = [
  { key: 'coordinate', label: 'Coordinate', note: 'Incidents + response' },
  { key: 'publish', label: 'Publish', note: 'Centres + mesh state' },
  { key: 'campaigns', label: 'Campaign', note: 'Create, inspect + transmit' },
  { key: 'wavepx-transmission', label: 'WavePX Transmission', note: 'Test, export + play' },
  { key: 'network', label: 'Packet network', note: 'Mesh + gateway + radio' },
];

export function App() {
  const [session, setSession] = useState<OperatorSession | undefined>(() => api.storedSession());
  const [section, setSection] = useState<SectionKey>('coordinate');
  const [wavePxPreselectId, setWavePxPreselectId] = useState('');
  const [overview, setOverview] = useState<Overview>();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [responders, setResponders] = useState<Responder[]>([]);
  const [records, setRecords] = useState<RegionalRecord[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [packets, setPackets] = useState<PacketStreamItem[]>([]);
  const [gatewayAudit, setGatewayAudit] = useState<GatewayAudit>({ gateways: [], observations: [], outbound: [], transfers: [] });
  const [notice, setNotice] = useState<{ text: string; error?: boolean }>();
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [lastRefreshAtMs, setLastRefreshAtMs] = useState<number>();
  const refreshing = useRef(false);

  useEffect(() => { if (!session) return; void api.authenticate(session.operatorLabel, session.operationsKey).then(setSession).catch(() => { api.signOut(); setSession(undefined); }); }, []);

  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const result = await Promise.all([api.overview(), api.incidents(), api.responders(), api.records(), api.campaigns(), api.packets(), api.gateways()]);
      setOverview(result[0]); setIncidents(result[1]); setResponders(result[2]); setRecords(result[3]); setCampaigns(result[4]); setPackets(result[5]); setGatewayAudit(result[6]); setConnection('connected'); setLastRefreshAtMs(Date.now());
    } catch (reason) { setNotice({ text: `Sync failed: ${errorText(reason)} Try again when the operations service is reachable.`, error: true }); setConnection('disconnected'); }
    finally { refreshing.current = false; setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(), 3_000); return () => window.clearInterval(timer); }, [refresh]);
  const perform = useCallback(async (label: string, action: () => Promise<unknown>) => {
    setNotice({ text: `${label}…` });
    try { await action(); await refresh(); setNotice({ text: `${label} complete` }); }
    catch (reason) { setNotice({ text: errorText(reason), error: true }); if (!api.storedSession()) setSession(undefined); }
  }, [refresh]);
  const openWavePxTransmission = useCallback((campaignId: string) => { setWavePxPreselectId(campaignId); setSection('wavepx-transmission'); }, []);

  if (!session) return <AccessGate onAuthenticated={setSession} />;

  return <div className="app-shell">
    <a className="skip-link" href="#workspace">Skip to workspace</a>
    <aside className="sidebar">
      <div className="brand-mark"><span>NDON</span><i /></div>
      <div className="product-name"><strong>National Disaster<br />Operations Network</strong><span>Mumbai deployment · {DEPLOYMENT.regionCode}</span></div>
      <nav aria-label="Primary operations">{NAV.map((item) => <button key={item.key} aria-current={section === item.key ? 'page' : undefined} className={section === item.key ? 'nav-item active' : 'nav-item'} onClick={() => setSection(item.key)}><b aria-hidden="true" /><span><strong>{item.label}</strong><small>{item.note}</small></span></button>)}</nav>
      <div className={`sidebar-status ${connection}`}><span className="live-dot" /><div><strong>{connection === 'connected' ? 'Operations API reachable' : connection === 'disconnected' ? 'Operations API offline' : 'Checking operations API'}</strong><small>{connection === 'connected' && lastRefreshAtMs ? <RefreshAge atMs={lastRefreshAtMs} /> : 'Retrying automatically'}</small></div></div>
    </aside>
    <main id="workspace" aria-busy={loading}>
      <header className="topbar"><div><span className="jurisdiction">National platform · Mumbai command</span><h1>{NAV.find((item) => item.key === section)?.label}</h1></div><div className="top-actions"><LiveClock /><span className="operator-label">{session.operatorLabel}</span><span className="deployment">{DEPLOYMENT.regionCode}</span><button className="button ghost" onClick={() => void refresh()}>Refresh</button><button className="button ghost" onClick={() => { api.signOut(); setSession(undefined); }}>Sign out</button></div></header>
      {overview && <Metrics overview={overview} packets={packets} records={records} gateways={gatewayAudit} />}
      {notice && <div className={notice.error ? 'notice error' : 'notice'} role={notice.error ? 'alert' : 'status'} aria-live={notice.error ? 'assertive' : 'polite'}>{notice.text}<button aria-label="Dismiss status message" onClick={() => setNotice(undefined)}>×</button></div>}
      <div className={section === 'publish' ? 'workspace workspace-map' : 'workspace'}>{loading ? <Loading /> : section === 'coordinate' ? <CoordinateV2 incidents={incidents} responders={responders} records={records} packets={packets} gatewayAudit={gatewayAudit} onAssign={(r, i) => perform('Responder assignment', () => api.assign(r, i))} onResponderAction={(r, action) => perform(`Responder ${action}`, () => api.updateResponder(r, action))} /> : section === 'publish' ? <PublishWorkspace records={records} packets={packets} onPublish={(id, state) => perform('Mesh publication', () => api.updateRecord(id, state))} onUpsert={(input) => perform(input.objectId ? 'Centre movement publication' : 'Temporary centre publication', () => api.upsertCentre(input))} /> : section === 'campaigns' ? <CampaignWorkspaceV2 campaigns={campaigns} incidents={incidents} records={records} perform={perform} onOpenTransmission={openWavePxTransmission} /> : section === 'wavepx-transmission' ? <WavePxTransmissionWorkspace campaigns={campaigns} preselectId={wavePxPreselectId} onRefresh={refresh} /> : <PacketNetwork packets={packets} gatewayAudit={gatewayAudit} />}</div>
    </main>
  </div>;
}

function Metrics({ overview, packets, records, gateways }: { overview: Overview; packets: PacketStreamItem[]; records: RegionalRecord[]; gateways: GatewayAudit }) {
  const restricted = records.filter((record) => isCentre(record) && !isOperationallyUsable(record)).length;
  const activeGateways = gateways.gateways.filter((gateway) => gatewayActivity(gateways, gateway.gatewayToken).ageMs < GATEWAY_ACTIVE_WINDOW_MS).length;
  return <div className="metrics" aria-label="Current operational totals"><Metric label="Incidents" value={overview.counts.activeIncidents} tone="danger" /><Metric label="Units ready" value={overview.counts.availableResponders} /><Metric label="Centres restricted" value={restricted} tone={restricted ? 'warning' : undefined} /><Metric label="Gateways active" value={activeGateways} /><Metric label="Packets moving" value={packets.filter((packet) => packet.outboundRegions.length > 0 || packet.observations.length > 0).length} /></div>;
}
function Metric({ label, value, tone }: { label: string; value: number; tone?: string }) { return <div className={`metric ${tone ?? ''}`}><strong>{String(value).padStart(2, '0')}</strong><span>{label}</span></div>; }

function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 1_000); return () => window.clearInterval(timer); }, []);
  return <time className="live-clock" dateTime={now.toISOString()}>{now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</time>;
}

function RefreshAge({ atMs }: { atMs: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1_000); return () => window.clearInterval(timer); }, []);
  return <>Data refreshed {formatAge(Math.floor((now - atMs) / 1000))} ago</>;
}

function Coordinate({ incidents, responders, onAssign, onResponderAction }: { incidents: Incident[]; responders: Responder[]; onAssign: (responder: string, incident: string) => void; onResponderAction: (responder: string, action: 'accepted' | 'en-route' | 'arrived' | 'resolved') => void }) {
  const [selectedId, setSelectedId] = useState(incidents[0]?.incidentId ?? '');
  const [severity, setSeverity] = useState('all');
  const [incidentState, setIncidentState] = useState('all');
  const [category, setCategory] = useState('all');
  const [age, setAge] = useState('all');
  const filtered = incidents.filter((item) => (severity === 'all' || item.severity === Number(severity)) && (incidentState === 'all' || item.state === incidentState) && (category === 'all' || item.category === Number(category)) && (age === 'all' || currentLocationAgeS(item) <= Number(age)));
  const selected = filtered.find((item) => item.incidentId === selectedId) ?? filtered[0];
  return <Page title="Incident command" meta={`${filtered.length} of ${incidents.length} canonical incidents · IN-MH · ${responders.length} organisation-provisioned responder units`}><div className="incident-filters" aria-label="Incident filters"><label>Severity<select value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="all">All severities</option><option value="3">Life critical</option><option value="2">Urgent</option><option value="1">Assistance</option><option value="0">Information</option></select></label><label>State<select value={incidentState} onChange={(event) => setIncidentState(event.target.value)}><option value="all">All states</option>{[...new Set(incidents.map((item) => item.state))].map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label>Type<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All incident types</option>{[...new Set(incidents.map((item) => item.category))].map((value) => <option key={value} value={value}>{categoryName(value)}</option>)}</select></label><label>Position freshness<select value={age} onChange={(event) => setAge(event.target.value)}><option value="all">Any age</option><option value="300">Within 5 minutes</option><option value="1800">Within 30 minutes</option><option value="3600">Within 1 hour</option></select></label></div><div className="command-grid">
    <section className="panel map-panel"><PanelHead title="Operational map" aside="Mumbai · last reported positions" /><OperationsMap incidents={filtered} records={[]} selected={selected?.incidentId ?? ''} onSelect={setSelectedId} /><div className="map-legend"><span><i className="pin critical" />Critical</span><span><i className="pin urgent" />Urgent</span><span><i className="pin facility" />Reported position, not a live tracker</span></div></section>
    <section className="panel incident-panel"><PanelHead title="Incident queue" aside="One row per incident ID" /><div className="data-list">{filtered.map((item) => <button key={item.incidentId} onClick={() => setSelectedId(item.incidentId)} className={selected?.incidentId === item.incidentId ? 'data-row selected' : 'data-row'}><Severity level={item.severity} /><span><strong>{categoryName(item.category)}</strong><small>{item.incidentId}</small></span><span className="align-right"><strong>{item.peopleTotal ?? 0} people</strong><small>{item.observationCount} gateway observation{item.observationCount === 1 ? '' : 's'}</small></span></button>)}</div>{filtered.length === 0 && <Empty text="No incidents match the selected filters." />}</section>
    <section className="panel detail-panel"><PanelHead title="Selected incident" aside={selected?.state ?? 'No selection'} />{selected ? <><div className="incident-title"><Severity level={selected.severity} /><div><h2>{categoryName(selected.category)} assistance</h2><code>{selected.incidentId}</code></div></div><dl className="facts"><Fact label="People reported" value={String(selected.peopleTotal ?? 0)} /><Fact label="Position age now" value={formatAge(currentLocationAgeS(selected))} /><Fact label="Reported accuracy" value={selected.locationAccuracyM == null ? 'Unknown' : `±${selected.locationAccuracyM}m`} /><Fact label="Assigned unit" value={selected.responderRef ?? 'Unassigned'} /></dl><div className="timeline">{selected.timeline.slice().reverse().map((event, i) => <div key={`${event.atS}-${i}`}><i /><span><strong>{event.summary}</strong><small>{formatTimelineSeconds(event.atS)}</small></span></div>)}</div></> : <Empty text="No validated incident packets match these filters." />}</section>
    <section className="panel roster-panel"><PanelHead title="Responder roster" aside="Organisation-provisioned identities" /><div className="roster">{responders.map((responder) => { const next = responder.status === 'assigned' ? 'accepted' : responder.status === 'accepted' ? 'en-route' : responder.status === 'en-route' ? 'arrived' : responder.status === 'arrived' ? 'resolved' : undefined; return <div className="roster-row" key={responder.responderRef}><span className={responder.available ? 'unit available' : 'unit busy'}>{responder.name.slice(0, 2).toUpperCase()}</span><div><strong>{responder.name}</strong><small>{responder.district} · {responder.capabilities.join(', ')}</small><small>Organisation-provisioned · {responder.responderRef}</small></div>{responder.available ? <select defaultValue="" onChange={(event) => event.target.value && onAssign(responder.responderRef, event.target.value)} aria-label={`Assign ${responder.name}`}><option value="" disabled>Assign incident</option>{incidents.filter((i) => !['resolved', 'cancelled', 'expired'].includes(i.state)).map((i) => <option key={i.incidentId} value={i.incidentId}>{categoryName(i.category)} · S{i.severity}</option>)}</select> : next ? <button className="button secondary" onClick={() => onResponderAction(responder.responderRef, next)}>{responderActionLabel(next)}</button> : <State value={responder.status} />}</div>; })}</div></section>
  </div></Page>;
}

function CoordinateV2({ incidents, responders, records, packets, gatewayAudit, onAssign, onResponderAction }: { incidents: Incident[]; responders: Responder[]; records: RegionalRecord[]; packets: PacketStreamItem[]; gatewayAudit: GatewayAudit; onAssign: (responder: string, incident: string) => void; onResponderAction: (responder: string, action: 'accepted' | 'en-route' | 'arrived' | 'resolved') => void }) {
  const activeIncidents = incidents.filter((item) => !['resolved', 'cancelled', 'expired'].includes(item.state));
  const [focus, setFocus] = useState<'all' | 'critical' | 'urgent'>('all');
  const visibleIncidents = activeIncidents.filter((item) => focus === 'all' || (focus === 'critical' ? item.severity >= 3 : item.severity === 2));
  const [selectedId, setSelectedId] = useState(activeIncidents[0]?.incidentId ?? records[0]?.objectId ?? '');
  const selectedIncident = activeIncidents.find((item) => item.incidentId === selectedId) ?? (selectedId ? undefined : activeIncidents[0]);
  const selectedRecord = records.find((item) => item.objectId === selectedId);
  const selectedGateway = gatewayAudit.gateways.find((item) => item.gatewayToken === selectedId);
  const critical = activeIncidents.filter((item) => item.severity >= 3).length;
  const centres = records.filter(isCentre);
  const availableCentres = centres.filter(isOperationallyUsable);
  const orderedRecords = records.slice().sort((left, right) => Number(isOperationallyUsable(left)) - Number(isOperationallyUsable(right)) || left.name.localeCompare(right.name));

  return <section className="command-atlas" aria-label="Mumbai live operations">
    <header className="atlas-header">
      <div>
        <h2>Live operations</h2>
        <p>{activeIncidents.length} active incidents across {new Set(records.map((record) => record.district)).size} districts</p>
      </div>
      <div className="severity-switch" aria-label="Filter incidents by urgency">
        <button className={focus === 'all' ? 'active' : ''} onClick={() => setFocus('all')}>All <b>{activeIncidents.length}</b></button>
        <button className={focus === 'critical' ? 'active critical' : ''} onClick={() => setFocus('critical')}>Critical <b>{critical}</b></button>
        <button className={focus === 'urgent' ? 'active urgent' : ''} onClick={() => setFocus('urgent')}>Urgent <b>{activeIncidents.filter((item) => item.severity === 2).length}</b></button>
      </div>
    </header>

    <div className="atlas-grid">
      <section className="atlas-map" aria-label="Operational map">
        <OperationsMap incidents={visibleIncidents} records={records} gateways={gatewayAudit} selected={selectedId} onSelect={setSelectedId} />
        <div className="atlas-map-key" aria-label="Map key">
          <span><i className="key-dot critical" />Critical</span>
          <span><i className="key-dot urgent" />Urgent</span>
          <span><i className="key-dot available" />Available centre</span>
          <span><i className="key-dot restricted" />Restricted</span>
          <span><i className="key-dot gateway" />Gateway</span>
        </div>
      </section>

      <aside className="operations-rail">
        <header><div><h3>Priority queue</h3><span>{visibleIncidents.length} shown</span></div><button className="icon-button" onClick={() => setFocus('all')} aria-label="Clear incident filter"><CloseIcon /></button></header>
        <div className="priority-list">
          {visibleIncidents.slice().sort((a, b) => b.severity - a.severity || b.updatedAtS - a.updatedAtS).map((incident) => <button key={incident.incidentId} className={selectedId === incident.incidentId ? 'priority-item selected' : 'priority-item'} onClick={() => setSelectedId(incident.incidentId)}>
            <span className={`priority-band severity-${incident.severity}`} />
            <span className="priority-copy"><strong>{categoryName(incident.category)}</strong><small>{incident.peopleTotal ?? 0} {(incident.peopleTotal ?? 0) === 1 ? 'person' : 'people'} · {formatAge(currentLocationAgeS(incident))} ago</small></span>
            <span className="priority-meta"><b>S{incident.severity}</b><small>{incident.observationCount} obs.</small></span>
          </button>)}
          {visibleIncidents.length === 0 && <Empty text="No active incidents in this priority band." />}
        </div>

        <div className="rail-section gateways-live">
          <header><h3>Gateway pulse</h3><span>{gatewayAudit.gateways.length} nodes</span></header>
          {gatewayAudit.gateways.map((gateway) => { const activity = gatewayActivity(gatewayAudit, gateway.gatewayToken); return <button className={selectedId === gateway.gatewayToken ? 'gateway-pulse selected' : 'gateway-pulse'} key={gateway.gatewayToken} onClick={() => setSelectedId(gateway.gatewayToken)}><i className={activity.ageMs < GATEWAY_ACTIVE_WINDOW_MS ? 'online' : 'stale'} /><span><strong>{gatewayLabel(gateway.nodeToken)}</strong><small>{gateway.telemetry ? `${gateway.telemetry.queueDepth} queued · battery ${gateway.telemetry.batteryBand === undefined ? 'unavailable' : `${gateway.telemetry.batteryBand}/3`}` : 'Runtime telemetry unavailable'}</small></span><time>{Number.isFinite(activity.ageMs) ? formatAge(Math.floor(activity.ageMs / 1000)) : 'never'}</time></button>; })}
        </div>
      </aside>
    </div>

    <div className="selection-deck">
      <section className="selection-primary">
        {selectedIncident ? <IncidentCommandCard incident={selectedIncident} responders={responders} onAssign={onAssign} /> : selectedRecord ? <ResourceCommandCard record={selectedRecord} packet={latestRecordPacket(packets, selectedRecord.objectId)} /> : selectedGateway ? <GatewayCommandCard gateway={selectedGateway} audit={gatewayAudit} /> : <Empty text="Select an incident, centre, route, hazard, or gateway." />}
      </section>
      <section className="unit-board">
        <header><h3>Response units</h3><span>{responders.filter((responder) => responder.available).length} ready</span></header>
        <div>{responders.map((responder) => <ResponderLine key={responder.responderRef} responder={responder} incidents={activeIncidents} onAssign={onAssign} onResponderAction={onResponderAction} />)}</div>
      </section>
      <section className="centre-board">
        <header><h3>Operational objects</h3><span>{availableCentres.length}/{centres.length} centres usable</span></header>
        <div className="availability-bar" aria-label={`${availableCentres.length} of ${centres.length} centres usable`}><i style={{ transform: `scaleX(${centres.length ? availableCentres.length / centres.length : 0})` }} /></div>
        <div>{orderedRecords.map((record) => { const packet = latestRecordPacket(packets, record.objectId); return <button key={record.objectId} className={selectedId === record.objectId ? 'selected' : ''} onClick={() => setSelectedId(record.objectId)}><span className={`centre-state state-${record.state}`} /><span><strong>{record.name}</strong><small>{record.kind.replaceAll('-', ' ')} · {packet ? `${directionShort(packet.direction)} · ${packet.observations.length} gateway obs.` : `record v${record.version}`}</small></span><State value={record.state} /></button>; })}</div>
      </section>
    </div>
  </section>;
}

function IncidentCommandCard({ incident, responders, onAssign }: { incident: Incident; responders: Responder[]; onAssign: (responder: string, incident: string) => void }) {
  return <div className="incident-command-card">
    <header><div><Severity level={incident.severity} /><span><h3>{categoryName(incident.category)} response</h3><code>{incident.incidentId}</code></span></div><State value={incident.state} /></header>
    <div className="incident-brief"><strong>{incident.peopleTotal ?? 0}</strong><span>people reported</span><strong>{incident.injured ?? 0}</strong><span>injured</span><strong>{formatAge(currentLocationAgeS(incident))}</strong><span>position age</span><strong>{incident.locationAccuracyM == null ? '—' : `±${incident.locationAccuracyM}m`}</strong><span>accuracy</span></div>
    <div className="incident-action-line"><label><span>Dispatch available unit</span><select defaultValue="" onChange={(event) => event.target.value && onAssign(event.target.value, incident.incidentId)}><option value="" disabled>Select response unit</option>{responders.filter((responder) => responder.available).map((responder) => <option value={responder.responderRef} key={responder.responderRef}>{responder.name} · {responder.district}</option>)}</select></label><div><span>Latest event</span><strong>{incident.timeline.at(-1)?.summary ?? 'Incident accepted'}</strong></div></div>
  </div>;
}

function ResourceCommandCard({ record, packet }: { record: RegionalRecord; packet?: PacketStreamItem }) {
  return <div className="resource-command-card"><header><div className={`resource-symbol ${record.kind}`}>{kindGlyph(record.kind)}</div><div><h3>{record.name}</h3><p>{record.kind.replaceAll('-', ' ')} · {record.district}</p></div><State value={record.state} /></header><div className={`resource-verdict ${isOperationallyUsable(record) ? '' : 'restricted'}`}><strong>{operationalVerdict(record)}</strong><span>{packet ? `${directionShort(packet.direction)} packet · ${packet.observations.length} gateway observation${packet.observations.length === 1 ? '' : 's'}` : `Authority record v${record.version}`} · updated {formatAge(Math.floor((Date.now() - record.updatedAtMs) / 1000))} ago</span></div><dl><Fact label="Object ID" value={record.objectId} /><Fact label="Packet" value={packet ? shortId(packet.packetId, 14) : 'No packet yet'} /><Fact label="Coordinates" value={`${e7ToFloat(record.latE7).toFixed(4)}, ${e7ToFloat(record.lonE7).toFixed(4)}`} /></dl></div>;
}

function GatewayCommandCard({ gateway, audit }: { gateway: GatewayAudit['gateways'][number]; audit: GatewayAudit }) {
  const activity = gatewayActivity(audit, gateway.gatewayToken);
  const observations = audit.observations.filter((item) => item.gatewayToken === gateway.gatewayToken);
  const latestTransfer = audit.transfers.filter((item) => item.gatewayToken === gateway.gatewayToken).sort((a, b) => b.atMs - a.atMs)[0];
  return <div className="resource-command-card"><header><div className="resource-symbol gateway">G</div><div><h3>{gatewayLabel(gateway.nodeToken)}</h3><p>{gateway.gatewayToken} · {gateway.regionCode}</p></div><State value={activity.ageMs < GATEWAY_ACTIVE_WINDOW_MS ? 'online' : 'stale'} /></header><div className="resource-verdict"><strong>{activity.uploads} uploaded · {activity.downloads} downloaded</strong><span>{observations.length} stored packet observation{observations.length === 1 ? '' : 's'} · last activity {formatAge(Math.floor(activity.ageMs / 1000))} ago</span></div><dl><Fact label="Latest transfer" value={latestTransfer ? `${latestTransfer.direction} · ${latestTransfer.itemCount} items` : 'No transfer'} /><Fact label="Map position" value="Configured development placement" /><Fact label="Node token" value={gateway.nodeToken} /></dl></div>;
}

function ResponderLine({ responder, incidents, onAssign, onResponderAction }: { responder: Responder; incidents: Incident[]; onAssign: (responder: string, incident: string) => void; onResponderAction: (responder: string, action: 'accepted' | 'en-route' | 'arrived' | 'resolved') => void }) {
  const next = responder.status === 'assigned' ? 'accepted' : responder.status === 'accepted' ? 'en-route' : responder.status === 'en-route' ? 'arrived' : responder.status === 'arrived' ? 'resolved' : undefined;
  return <div className="unit-line"><i className={responder.available ? 'ready' : 'deployed'} /><span><strong>{responder.name}</strong><small>{responder.district} · {responder.capabilities.slice(0, 2).join(', ')}</small></span>{responder.available ? <select defaultValue="" onChange={(event) => event.target.value && onAssign(responder.responderRef, event.target.value)} aria-label={`Assign ${responder.name}`}><option value="" disabled>Assign</option>{incidents.map((incident) => <option value={incident.incidentId} key={incident.incidentId}>{categoryName(incident.category)} · S{incident.severity}</option>)}</select> : next ? <button className="button secondary" onClick={() => onResponderAction(responder.responderRef, next)}>{responderActionLabel(next)}</button> : <State value={responder.status} />}</div>;
}

function CampaignWorkspaceV2({ campaigns, incidents, records, perform, onOpenTransmission }: { campaigns: Campaign[]; incidents: Incident[]; records: RegionalRecord[]; perform: (label: string, action: () => Promise<unknown>) => Promise<void>; onOpenTransmission: (campaignId: string) => void }) {
  const [selectedId, setSelectedId] = useState(campaigns[0]?.campaignId ?? '');
  const [view, setView] = useState<'register' | 'new' | 'edit'>('register');
  const selected = campaigns.find((campaign) => campaign.campaignId === selectedId) ?? campaigns[0];
  const liveCount = campaigns.filter((campaign) => !['draft', 'archived', 'failed'].includes(campaign.state)).length;
  const prepare = async (campaign: Campaign) => {
    if (campaign.state === 'approved') await api.transitionCampaign(campaign.campaignId, 'broadcaster-ready');
    await api.prepareBroadcast(campaign.campaignId);
  };

  return <section className="campaign-desk">
    <header className="campaign-desk-header">
      <div><h2>Campaign broadcast desk</h2><p>Create the message, inspect the exact packet and phone impact, then test and play WavePX audio from one workflow.</p></div>
      <nav aria-label="Campaign workspaces">
        <button className={view === 'register' ? 'active' : ''} onClick={() => setView('register')}>Register</button>
        <button className={view === 'new' ? 'active' : ''} onClick={() => setView('new')}>New message</button>
      </nav>
    </header>

    {view === 'register' && <div className="campaign-register-layout">
      <section className="campaign-register-v2" aria-label="Campaign versions">
        <header><span>All campaigns</span><button className="button primary" onClick={() => setView('new')}>Create message</button></header>
        <div>{campaigns.slice().sort((a, b) => b.updatedAtMs - a.updatedAtMs).map((campaign) => <button key={campaign.campaignId} onClick={() => setSelectedId(campaign.campaignId)} className={selected?.campaignId === campaign.campaignId ? 'campaign-register-row selected' : 'campaign-register-row'}>
          <span className={`campaign-state-band state-${campaign.state}`} />
          <span><strong>{campaign.title}</strong><small>{campaignTypeName(campaign.dataType)} · v{campaign.campaignVersion} · {formatDateTime(campaign.updatedAtMs)}</small></span>
          <State value={campaign.state} />
        </button>)}</div>
      </section>
      <section className="campaign-focus">
        {selected ? <>
          <header className="campaign-focus-header"><div><State value={selected.state} /><h3>{selected.title}</h3><p>{selected.summary}</p></div><div className="focus-actions"><button className="button secondary" onClick={() => setView('edit')}>Update message</button>{selected.broadcastProgram && <button className="button ghost" onClick={() => onOpenTransmission(selected.campaignId)}>Open in WavePX Transmission</button>}</div></header>
          <CampaignFlow campaign={selected} />
          <CampaignPacketPreview campaign={selected} />
          <CampaignApproval campaign={selected} onAction={(state) => perform(campaignActionLabel(state), () => api.transitionCampaign(selected.campaignId, state))} onPrepare={() => perform('Create WavePX audio program', () => prepare(selected))} />
        </> : <Empty text="Create the first campaign to begin the register." />}
      </section>
    </div>}

    {view !== 'register' && <div className="campaign-editor-layout">
      <aside><button className="back-link" onClick={() => setView('register')}>← Back to register</button><h3>Compose broadcast data</h3><p>Create a public alert or publish the current state of a mapped resource, route, or hazard.</p><div className="editor-selection"><span>Selected version</span><strong>{selected?.title ?? 'New campaign'}</strong><small>{selected?.campaignId ?? 'A new ID will be created'}</small></div></aside>
      <div className="campaign-editor"><CampaignComposer campaigns={campaigns} selected={view === 'edit' ? selected : undefined} initialEditing={view === 'edit'} incidents={incidents} records={records} onSelect={setSelectedId} onCreate={(input) => perform('Create campaign packet', async () => { const created = await api.createCampaign(input); setSelectedId(created.campaignId); setView('register'); })} onUpdate={(id, input) => perform('Save campaign update', async () => { const updated = await api.updateCampaign(id, input); setSelectedId(updated.campaignId); setView('register'); })} /></div>
    </div>}

  </section>;
}

function WavePxTransmissionWorkspace({ campaigns, preselectId, onRefresh }: { campaigns: Campaign[]; preselectId?: string; onRefresh: () => Promise<void> }) {
  const prepared = wavePxCampaigns(campaigns);
  const [selectedId, setSelectedId] = useState('');
  useEffect(() => { if (preselectId) setSelectedId(preselectId); }, [preselectId]);
  const selected = selectWavePxCampaign(prepared, selectedId);

  return <section className="wavepx-workspace">
    <header className="wavepx-header">
      <div><span className="wavepx-kicker">Tier 2 acoustic link</span><h2>WavePX station</h2><p>Play, export, or recover the exact audio artifact prepared from an approved packet.</p></div>
      <label><span>Prepared artifact</span><select value={selected?.campaignId ?? ''} onChange={(event) => setSelectedId(event.target.value)} disabled={prepared.length === 0}><option value="" disabled>{prepared.length === 0 ? 'No prepared artifacts' : 'Select artifact'}</option>{prepared.map((campaign) => <option value={campaign.campaignId} key={campaign.campaignId}>{campaign.title} · {flowName(campaign.state)}</option>)}</select></label>
    </header>
    {selected ? <>
      <div className="wavepx-summary" aria-label="Selected WavePX artifact">
        <span><small>Campaign</small><strong>{selected.title}</strong></span>
        <span><small>State</small><State value={selected.state} /></span>
        <span><small>Program</small><code>{selected.broadcastProgram?.programId}</code></span>
        <span><small>Frames</small><strong>{selected.broadcastProgram?.playbackFramesBase64.length ?? 0}</strong></span>
      </div>
      <BroadcastConsole campaign={selected} onRefresh={onRefresh} />
    </> : <Empty text="Prepare a WavePX program from an approved campaign, then return here to transmit or decode it." />}
  </section>;
}

function CampaignFlow({ campaign }: { campaign?: Campaign }) {
  const steps = [
    { label: 'Compose', states: ['draft'] },
    { label: 'Review + approve', states: ['validated', 'approved', 'broadcaster-ready'] },
    { label: 'Generate + decode', states: ['audio-generated', 'decode-tested'] },
    { label: 'Transmit', states: ['scheduled', 'played', 'archived'] },
  ] as const;
  const current = campaign ? Math.max(0, steps.findIndex((step) => step.states.some((state) => state === campaign.state))) : -1;
  return <div className="campaign-flow">{steps.map((step, index) => <div key={step.label} className={index < current ? 'done' : index === current ? 'current' : ''}><i>{index < current ? '✓' : index + 1}</i><span>{step.label}</span></div>)}</div>;
}

function CampaignPacketPreview({ campaign }: { campaign: Campaign }) {
  const preview = campaign.packetPreview;
  if (!preview) return <section className="campaign-packet-preview" aria-label="Campaign packet evidence unavailable"><header><div><span>STORED PACKET</span><h3>Packet evidence is being rebuilt</h3></div><code>{campaign.packetId}</code></header><div className="no-map-impact"><b>This legacy campaign remains available.</b><small>Refresh once the backend has reconstructed its decoded payload and map effects from the stored canonical bytes.</small></div></section>;
  const effects = preview.mapOperations;
  return <section className="campaign-packet-preview" aria-label="Exact campaign packet and expected phone changes">
    <header><div><span>EXACT PACKET</span><h3>What the phone will decode</h3></div><code>{campaign.packetId}</code></header>
    <div className="packet-message-preview"><span>{preview.typeName} · Severity {campaign.severity}</span><strong>{campaign.summary}</strong><small>{preview.family} packet from {preview.sourceLabel} · {preview.totalBytes} canonical bytes · {campaign.preview.totalTier2Bytes} WavePX bytes</small></div>
    <div className="packet-impact-grid">
      <div><span>Decoded payload</span><dl><Fact label="Campaign" value={String(preview.payload['campaignId'] ?? campaign.campaignId)} /><Fact label="Instruction" value={instructionName(campaign.instruction)} /><Fact label="Category" value={campaign.dataType === 'official-alert' ? alertCategoryName(campaign.category) : campaignTypeName(campaign.dataType)} /><Fact label="Location" value={coordinateText(campaign.latE7, campaign.lonE7)} /></dl></div>
      <div><span>Changes after acceptance</span>{effects.length ? <ul>{effects.map((operation, index) => <li key={`${operation.kind}-${index}`}><b>{mapOperationLabel(operation)}</b><small>{mapOperationDetail(operation)}</small></li>)}</ul> : <div className="no-map-impact"><b>No map geometry changes</b><small>The phone stores and displays this official instruction. Only packet types with typed map operations alter map objects.</small></div>}</div>
    </div>
    <details className="packet-raw-evidence"><summary>Inspect decoded JSON and exact bytes</summary><div><pre>{JSON.stringify(preview.payload, null, 2)}</pre><pre>{preview.bytesHex}</pre></div></details>
  </section>;
}

const REGION_CENTRE = { lat: 19.09, lon: 72.85 };

function CampaignComposer({ campaigns, selected, initialEditing = false, incidents, records, onCreate, onUpdate, onSelect }: { campaigns: Campaign[]; selected?: Campaign; initialEditing?: boolean; incidents: Incident[]; records: RegionalRecord[]; onCreate: (input: CampaignDraftInput) => void; onUpdate: (id: string, input: CampaignDraftInput) => void; onSelect: (id: string) => void }) {
  const [title, setTitle] = useState(''); const [summary, setSummary] = useState(''); const [severity, setSeverity] = useState(2); const [dataType, setDataType] = useState<'official-alert' | 'regional-record' | 'check-in'>('official-alert'); const [objectId, setObjectId] = useState(records[0]?.objectId ?? '');
  const [category, setCategory] = useState(2); const [instruction, setInstruction] = useState(2); const [profile, setProfile] = useState<'audible-fast' | 'audible-normal' | 'ultrasound-normal'>('audible-normal'); const [editingId, setEditingId] = useState('');
  const [point, setPoint] = useState<{ lat: number; lon: number } | null>(REGION_CENTRE); const [radiusM, setRadiusM] = useState(5000);
  const carriesPoint = dataType === 'official-alert' && point !== null;
  const summaryBytes = new TextEncoder().encode(summary).length; const titleBytes = new TextEncoder().encode(title).length; const overTextBudget = summaryBytes > 140 || titleBytes > 72;
  const input = (): CampaignDraftInput => ({ title, summary, severity, category, instruction, profile, dataType, ...(dataType === 'regional-record' ? { objectId } : {}), ...(carriesPoint && point ? { latE7: floatToE7(point.lat), lonE7: floatToE7(point.lon), radiusM } : dataType === 'official-alert' ? { clearLocation: true } : {}) });
  const submit = (e: FormEvent) => { e.preventDefault(); if (overTextBudget) return; editingId ? onUpdate(editingId, input()) : onCreate(input()); };
  const beginEdit = () => { if (!selected) return; setEditingId(selected.campaignId); setTitle(selected.title); setSummary(selected.summary); setSeverity(selected.severity); setCategory(selected.category); setInstruction(selected.instruction); setProfile(selected.profile as typeof profile); setDataType(selected.dataType ?? 'official-alert'); setObjectId(selected.objectId ?? records[0]?.objectId ?? ''); setPoint(typeof selected.latE7 === 'number' && typeof selected.lonE7 === 'number' ? { lat: e7ToFloat(selected.latE7), lon: e7ToFloat(selected.lonE7) } : null); setRadiusM(selected.radiusM ?? 5000); };
  useEffect(() => { if (initialEditing && selected) beginEdit(); }, [initialEditing, selected?.campaignId]);
  // Clicking a marker adopts that feature's coordinates as the broadcast point.
  const adoptFeature = (id: string) => { const incident = incidents.find((item) => item.incidentId === id); if (incident?.latE7 != null && incident.lonE7 != null) { setPoint({ lat: e7ToFloat(incident.latE7), lon: e7ToFloat(incident.lonE7) }); return; } const record = records.find((item) => item.objectId === id); if (record) setPoint({ lat: e7ToFloat(record.latE7), lon: e7ToFloat(record.lonE7) }); };
  return <section className="panel composer-panel"><PanelHead title="Campaign register" aside={`${campaigns.length} versions`} /><div className="campaign-list">{campaigns.map((c) => <button key={c.campaignId} onClick={() => onSelect(c.campaignId)}><span><strong>{c.title}</strong><small>{campaignTypeName(c.dataType)} · {c.campaignId}</small></span><State value={c.state} /></button>)}</div><form className="composer" onSubmit={submit}><div className="composer-heading"><h3>{editingId ? `Update ${selected?.title ?? editingId}` : 'Create a broadcast message'}</h3>{selected && !editingId && <button type="button" className="button ghost" onClick={beginEdit}>Update selected</button>}{editingId && <span className="revision-warning">Saving creates v{(selected?.campaignVersion ?? 0) + 1} and requires approval again.</span>}</div><fieldset className="data-type-picker"><legend>What should phones receive?</legend><label><input type="radio" name="dataType" checked={dataType === 'official-alert'} onChange={() => setDataType('official-alert')} /><span><b>Public instruction</b><small>Show an alert message, severity, action and optional area</small></span></label><label><input type="radio" name="dataType" checked={dataType === 'regional-record'} onChange={() => setDataType('regional-record')} /><span><b>Map update</b><small>Change a shelter, medical point, hazard, safe zone, food point or route</small></span></label><label><input type="radio" name="dataType" checked={dataType === "check-in"} onChange={() => setDataType("check-in")} /><span><b>Safety check-in</b><small>Ask households to respond through Bluetooth mesh or a gateway</small></span></label></fieldset>{dataType === "regional-record" && <label>Map item to send<select value={objectId} onChange={(event) => setObjectId(event.target.value)} required>{records.map((record) => <option key={record.objectId} value={record.objectId}>{record.name} · currently {record.state}</option>)}</select><small className="field-hint">The packet carries this item's current state and coordinates. Update the item under Publish first if its state has changed.</small></label>}<label>Internal campaign name<input value={title} onChange={(e) => setTitle(e.target.value)} required aria-describedby="title-budget" /></label><small id="title-budget" className={titleBytes > 72 ? 'field-error' : 'field-hint'}>{titleBytes}/72 UTF-8 bytes</small><label>Message shown on phones<textarea value={summary} onChange={(e) => setSummary(e.target.value)} required aria-describedby="summary-budget" /></label><small id="summary-budget" className={summaryBytes > 140 ? 'field-error' : 'field-hint'}>{summaryBytes}/140 UTF-8 bytes</small><div className="inline-fields"><label>Urgency<select value={severity} onChange={(e) => setSeverity(Number(e.target.value))}><option value="0">Information</option><option value="1">Assistance</option><option value="2">Urgent</option><option value="3">Life critical</option></select></label><label>Audio delivery<select value={profile} onChange={(e) => setProfile(e.target.value as typeof profile)}><option value="audible-normal">Audible · reliable</option><option value="audible-fast">Audible · faster</option><option value="ultrasound-normal">Near-ultrasonic</option></select></label></div>{dataType === 'official-alert' && <div className="inline-fields"><label>Alert type<select value={category} onChange={(e) => setCategory(Number(e.target.value))}>{['Evacuation', 'Shelter in place', 'Weather', 'Utility', 'Health', 'Security', 'All clear'].map((label, value) => <option value={value} key={label}>{label}</option>)}</select></label><label>Action phones display<select value={instruction} onChange={(e) => setInstruction(Number(e.target.value))}>{['No coded instruction', 'Evacuate now', 'Move to higher ground', 'Stay indoors', 'Boil water', 'Avoid area', 'Report to shelter', 'Await instruction'].map((label, value) => <option value={value} key={label}>{label}</option>)}</select></label></div>}{dataType === 'official-alert'
    ? <LocationPicker incidents={incidents} records={records} point={point} radiusM={radiusM} onPoint={setPoint} onRadius={setRadiusM} onAdopt={adoptFeature} />
    : dataType === 'regional-record'
      ? <p className="composer-note">The selected map item's stored state and coordinates will be encoded in the canonical packet.</p>
      : <p className="composer-note">Phones open the cached Mumbai safety form. Responses return through Bluetooth mesh and an available gateway; WavePX remains one-way.</p>}<button className="button primary" disabled={overTextBudget}>{editingId ? 'Save update and review packet' : 'Create packet and review it'}</button></form></section>;
}

function LocationPicker({ incidents, records, point, radiusM, onPoint, onRadius, onAdopt }: { incidents: Incident[]; records: RegionalRecord[]; point: { lat: number; lon: number } | null; radiusM: number; onPoint: (value: { lat: number; lon: number } | null) => void; onRadius: (value: number) => void; onAdopt: (id: string) => void }) {
  const setAxis = (axis: 'lat' | 'lon', raw: string) => { const value = Number(raw); if (!Number.isFinite(value)) return; const base = point ?? REGION_CENTRE; onPoint(axis === 'lat' ? { lat: clampDegrees(value, 90), lon: base.lon } : { lat: base.lat, lon: clampDegrees(value, 180) }); };
  return <fieldset className="location-picker"><legend>Broadcast location</legend>
    <p className="composer-note">These coordinates travel inside the acoustic packet. Reception decodes them back and compares them with what was approved.</p>
    <div className="picker-map"><OperationsMap incidents={incidents} records={records} selected="" compact onSelect={onAdopt} pick={point} onPick={(lat, lon) => onPoint({ lat, lon })} /></div>
    <div className="inline-fields"><label>Latitude<input type="number" step="0.00001" min={-90} max={90} value={point ? point.lat.toFixed(5) : ''} placeholder="No point" onChange={(e) => setAxis('lat', e.target.value)} /></label><label>Longitude<input type="number" step="0.00001" min={-180} max={180} value={point ? point.lon.toFixed(5) : ''} placeholder="No point" onChange={(e) => setAxis('lon', e.target.value)} /></label><label>Radius<select value={radiusM} onChange={(e) => onRadius(Number(e.target.value))}><option value="1000">1 km</option><option value="5000">5 km</option><option value="10000">10 km</option><option value="25000">25 km</option><option value="50000">50 km</option></select></label></div>
    <div className="picker-actions">{incidents.slice(0, 3).map((incident) => <button type="button" key={incident.incidentId} className="chip" onClick={() => onAdopt(incident.incidentId)}>{categoryName(incident.category)} · {shortId(incident.incidentId, 14)}</button>)}<button type="button" className="chip" onClick={() => onPoint(REGION_CENTRE)}>Region centre</button><button type="button" className="chip ghost" onClick={() => onPoint(null)} disabled={!point}>No location</button></div>
    <div className="picker-readout">{point ? <><span>Sending</span><code>{point.lat.toFixed(5)}, {point.lon.toFixed(5)}</code><b>±{(radiusM / 1000).toFixed(radiusM % 1000 === 0 ? 0 : 1)} km</b></> : <span>No coordinates will be broadcast with this alert.</span>}</div>
  </fieldset>;
}

function clampDegrees(value: number, limit: number): number { return Math.min(limit, Math.max(-limit, value)); }
function CampaignApproval({ campaign, onAction, onPrepare }: { campaign: Campaign; onAction: (state: CampaignState) => void; onPrepare: () => void }) {
  const next: CampaignState | undefined = campaign.state === 'draft' ? 'validated' : campaign.state === 'validated' ? 'approved' : campaign.state === 'decode-tested' ? 'scheduled' : campaign.state === 'played' ? 'archived' : undefined;
  return <div className="approval"><div className="approval-copy"><div className="approval-labels"><State value={campaign.state} /><span>{campaignTypeName(campaign.dataType)}</span></div><h2>{campaignStepTitle(campaign.state)}</h2><p>{campaignStepHelp(campaign.state)}</p></div><dl className="facts"><Fact label="WavePX bytes" value={String(campaign.preview.totalTier2Bytes)} /><Fact label="Unique frames" value={String(campaign.preview.items[0]?.frameCount ?? 0)} /><Fact label="Playback copies" value={`${campaign.preview.items[0]?.repeats ?? 0}×`} /><Fact label="Audio / limit" value={`${campaign.preview.totalDurationS}s / ${campaign.preview.budgetS}s`} /><Fact label="Broadcast point" value={coordinateText(campaign.latE7, campaign.lonE7)} /><Fact label="Radius" value={campaign.radiusM ? `${(campaign.radiusM / 1000).toFixed(campaign.radiusM % 1000 === 0 ? 0 : 1)} km` : '—'} /></dl>{campaign.preview.overBudget && <p className="field-error" role="alert">Shorten the message or choose faster audio. This campaign cannot proceed while it exceeds the airtime limit.</p>}<details className="inventory"><summary>Technical frame plan</summary>{campaign.preview.items.map((item) => <div key={item.packetId}><code>{item.packetId}</code><span>{item.tier1Bytes} B packet · {item.tier2Bytes} B over WavePX · {item.frameCount} frames · {item.repeats} copies</span></div>)}<p>{campaign.preview.burstSchedule.length} scheduled frame bursts.</p></details>{campaign.approvalDigest && <div className="digest"><span>Approved packet digest</span><code>{campaign.approvalDigest}</code></div>}<div className="action-line">{next && <button className="button primary" onClick={() => onAction(next)}>{next === 'validated' ? 'Packet looks right — continue' : next === 'approved' ? 'Approve this exact packet' : next === 'scheduled' ? 'Schedule for transmission' : 'Archive campaign'}</button>}{['approved', 'broadcaster-ready'].includes(campaign.state) && <button className="button primary" onClick={onPrepare}>Create WavePX audio</button>}</div></div>;
}

function BroadcastConsole({ campaign, onRefresh }: { campaign?: Campaign; onRefresh: () => Promise<void> }) {
  const [mode, setMode] = useState<'send' | 'receive'>('send'); const [state, setState] = useState('Ready'); const [frames, setFrames] = useState<string[]>([]); const [frameSource, setFrameSource] = useState<'tier2-mic' | 'tier2-direct'>('tier2-mic'); const [level, setLevel] = useState(0); const [busy, setBusy] = useState(false); const [previewing, setPreviewing] = useState(false); const [decoded, setDecoded] = useState(campaign?.decodeResult?.decodedMessage); const link = useRef<Tier2AudioLink>(); const submitted = useRef(''); const previewRun = useRef(0);
  useEffect(() => () => link.current?.destroy(), []); useEffect(() => { setDecoded(campaign?.decodeResult?.decodedMessage); }, [campaign?.decodeResult]);
  const program = campaign?.broadcastProgram; const expected = program?.uniqueFramesBase64.length ?? 0;
  const makeLink = (receive = false) => { link.current?.destroy(); const next = new Tier2AudioLink({ onLevel: setLevel, onState: (s) => setState(s === 'listening' ? 'Listening to microphone' : s === 'transmitting' ? 'Broadcasting audio' : s === 'initializing' ? 'Starting WavePX modem' : 'Ready'), onError: (error) => setState(error.message), onFrame: receive ? (frame) => setFrames((all) => { const encoded = encodeBase64(frame); return all.includes(encoded) ? all : [...all, encoded]; }) : undefined }); link.current = next; return next; };
  const submitReception = useCallback(async (source: 'tier2-mic' | 'tier2-direct') => { if (!campaign || frames.length === 0) return; const key = `${campaign.campaignId}:${frames.join('.')}`; if (submitted.current === key) return; submitted.current = key; setBusy(true); try { const updated = await api.reportReception(campaign.campaignId, frames, source); setDecoded(updated.decodeResult?.decodedMessage); setState(updated.decodeResult?.passed ? `Exact packet recovered and decoded${mapOperationStatus(updated.decodeResult?.mapOperations)}` : `${updated.decodeResult?.missingFrames ?? 0} expected frame(s) missing`); await onRefresh(); } catch (reason) { setState(errorText(reason)); submitted.current = ''; } finally { setBusy(false); } }, [campaign, frames, onRefresh]);
  useEffect(() => { if (mode === 'receive' && expected > 0 && frames.length >= expected) void submitReception(frameSource); }, [expected, frameSource, frames.length, mode, submitReception]);
  if (!campaign) return <Empty text="Select a campaign." />; if (!program) return <Empty text="Complete approval and generate the acoustic program to enable transmission." />;
  const transmit = async () => { if (campaign.state !== 'scheduled') { setState('Schedule the verified program before playback.'); return; } setBusy(true); try { const completed = await makeLink().transmit(program.playbackFramesBase64.map(decodeBase64), program.profile); if (!completed) { setState('Playback stopped before completion'); return; } await api.recordBroadcastEvent(campaign.campaignId, 'played'); setState('Playback completed and recorded against the tested artifact'); await onRefresh(); } catch (reason) { setState(errorText(reason)); } finally { setBusy(false); } };
  const listen = async () => { setFrames([]); setFrameSource('tier2-mic'); submitted.current = ''; try { await makeLink(true).listen(); } catch (reason) { setState(errorText(reason)); } };
  const decodeFile = async (file: File) => { setBusy(true); setFrames([]); setFrameSource('tier2-direct'); submitted.current = ''; try { const recovered = await makeLink().decodeAudioFile(file); const unique = [...new Set(recovered.map(encodeBase64))]; setFrames(unique); submitted.current = `${campaign.campaignId}:${unique.join('.')}`; const updated = await api.reportReception(campaign.campaignId, unique, 'tier2-direct'); setDecoded(updated.decodeResult?.decodedMessage); setState(updated.decodeResult?.passed ? `WAV software decode matched the approved packet${mapOperationStatus(updated.decodeResult?.mapOperations)}` : `${updated.decodeResult?.missingFrames ?? 0} frame(s) missing`); await onRefresh(); } catch (reason) { setState(errorText(reason)); submitted.current = ''; } finally { setBusy(false); } };
  const testGeneratedAudio = async () => { setBusy(true); setFrames([]); setFrameSource('tier2-direct'); submitted.current = ''; setState('Generating and decoding the WavePX WAV'); try { const modem = makeLink(); await modem.init(program.profile); const wav = modem.createWav(program.playbackFramesBase64.map(decodeBase64), program.profile); const recovered = await modem.decodeAudioFile(wav); const unique = [...new Set(recovered.map(encodeBase64))]; setFrames(unique); const updated = await api.reportReception(campaign.campaignId, unique, 'tier2-direct'); setDecoded(updated.decodeResult?.decodedMessage); setState(updated.decodeResult?.passed ? `Generated audio decoded to the exact approved packet${mapOperationStatus(updated.decodeResult?.mapOperations)}` : `Decode failed · ${updated.decodeResult?.missingFrames ?? 0} frame(s) missing`); await onRefresh(); } catch (reason) { setState(errorText(reason)); } finally { setBusy(false); } };
  const exportWav = async () => { if (!campaign.decodeResult?.passed || !['decode-tested', 'scheduled'].includes(campaign.state)) { setState('Pass exact decode testing before export.'); return; } setBusy(true); try { const modem = makeLink(); await modem.init(program.profile); const blob = modem.createWav(program.playbackFramesBase64.map(decodeBase64), program.profile); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${program.programId}.wav`; a.click(); URL.revokeObjectURL(url); await api.recordBroadcastEvent(campaign.campaignId, 'exported'); setState('WAV exported and recorded against the tested artifact'); await onRefresh(); } catch (reason) { setState(errorText(reason)); } finally { setBusy(false); } };
  const previewAudio = async () => { const run = ++previewRun.current; setBusy(true); setPreviewing(true); setState('Preparing audio preview'); try { const completed = await makeLink().transmit(program.playbackFramesBase64.map(decodeBase64), program.profile, (sent, total) => { if (run === previewRun.current) setState(`Playing preview · frame ${sent} of ${total}`); }); if (completed && run === previewRun.current) setState('Audio preview complete'); } catch (reason) { if (run === previewRun.current) setState(errorText(reason)); } finally { if (run === previewRun.current) { setBusy(false); setPreviewing(false); } } };
  const stopAudio = () => { if (!previewing) return; previewRun.current += 1; link.current?.stopTransmission(); setBusy(false); setPreviewing(false); setState('Audio preview stopped'); };
  const canExport = campaign.decodeResult?.passed === true && ['decode-tested', 'scheduled'].includes(campaign.state); const canPlay = campaign.state === 'scheduled';
  return <div className="broadcast-console"><div className="mode-tabs"><button className={mode === 'send' ? 'active' : ''} onClick={() => setMode('send')}>Send audio</button><button className={mode === 'receive' ? 'active' : ''} onClick={() => setMode('receive')}>Decode received audio</button></div><div className="audio-preview"><div><strong>Play WavePX to a listening phone</strong><span>{program.playbackFramesBase64.length} frames · {profileLabel(program.profile)} · uses this computer's speakers</span></div><div className="action-line"><button className="button primary" disabled={busy} onClick={() => void previewAudio()}>Play test audio</button><button className="button ghost" disabled={!previewing} onClick={stopAudio}>Stop</button></div></div><div className="station-state" role="status"><span className="live-dot" /><strong>{state}</strong></div>{mode === 'send' ? <><div className="program-strip"><span><small>Program</small><code>{program.programId}</code></span><span><small>Audio decode</small><strong>{campaign.decodeResult?.passed ? 'Exact packet recovered' : 'Test required'}</strong></span><span><small>Playback</small><strong>{program.playbackFramesBase64.length} frames</strong></span></div>{campaign.state === 'audio-generated' && <div className="guided-action"><div><strong>Required next step</strong><span>Generate a WAV in this browser, decode it through WavePX, and compare the recovered packet byte-for-byte.</span></div><button className="button primary" disabled={busy} onClick={() => void testGeneratedAudio()}>Run WavePX decode test</button></div>}<div className="action-line"><button className="button primary" disabled={busy || !canPlay} onClick={() => void transmit()}>Transmit scheduled campaign</button><button className="button secondary" disabled={busy || !canExport} onClick={() => void exportWav()}>Download tested WAV</button></div>{!canExport && campaign.state !== 'audio-generated' && <p className="field-hint">Pass the generated-audio decode test before export or scheduled playback.</p>}</> : <><div className="receiver-meter" aria-label="Microphone input level"><i style={{ width: `${Math.min(100, level * 900)}%` }} /></div><strong className="frame-count">{frames.length}/{expected} frames · {frameSource === 'tier2-mic' ? 'microphone' : 'WAV file'}</strong><div className="action-line"><button className="button primary" onClick={() => void listen()}>Listen through this microphone</button><button className="button ghost" onClick={() => link.current?.stopListening()}>Stop</button><label className="button secondary file-button">Decode a WAV<input type="file" accept="audio/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) void decodeFile(file); }} /></label><button className="button secondary" disabled={busy || frames.length === 0} onClick={() => void submitReception(frameSource)}>Compare recovered packet</button></div>{decoded && <div className="decoded-message"><span>Recovered message</span><h3>{alertCategoryName(decoded.category)} · Severity {decoded.severity}</h3><p>{decoded.text}</p><dl><Fact label="Campaign" value={decoded.campaignId} /><Fact label="Region" value={decoded.regionCode} /><Fact label="Language" value={decoded.language} /><Fact label="Recovered point" value={coordinateText(decoded.location?.latE7, decoded.location?.lonE7)} /><Fact label="Radius" value={decoded.location?.radiusM ? `${(decoded.location.radiusM / 1000).toFixed(decoded.location.radiusM % 1000 === 0 ? 0 : 1)} km` : '—'} /></dl>{decoded.location && <p className={decoded.location.matchesApproved ? 'verify-chip pass' : 'verify-chip fail'}>{decoded.location.matchesApproved ? 'Coordinates match the approved packet' : 'Coordinates differ from the approved packet'}</p>}</div>}</>}<WavePxEvidence campaign={campaign} frames={frames} frameSource={frameSource} decoded={decoded} /><details className="audio-evidence"><summary>Technical frames and transmission history</summary><dl><Fact label="Artifact digest" value={program.artifactDigest} /><Fact label="Unique frames" value={String(program.uniqueFramesBase64.length)} /><Fact label="Playback frames" value={String(program.playbackFramesBase64.length)} /><Fact label="Recovered now" value={String(frames.length)} /></dl><div className="frame-ledger">{program.uniqueFramesBase64.map((frame, index) => <div key={`${frame.slice(0, 16)}-${index}`}><span>Expected {index + 1}</span><code>{frame}</code><b>{Math.floor(frame.length * .75)} B encoded</b></div>)}{frames.map((frame, index) => <div className="recovered" key={`recovered-${frame.slice(0, 16)}-${index}`}><span>Recovered {index + 1}</span><code>{frame}</code><b>{program.uniqueFramesBase64.includes(frame) ? 'Expected match' : 'Unexpected'}</b></div>)}</div>{campaign.decodeResult && <div className="decode-proof"><span>{campaign.decodeResult.receptionTransport === 'tier2-mic' ? 'Microphone recovery' : 'Generated/file WAV recovery'}</span><strong>{campaign.decodeResult.passed ? 'Exact comparison passed' : 'Comparison failed'}</strong><small>{campaign.decodeResult.recoveredFrames}/{campaign.decodeResult.expectedFrames} recovered · {campaign.decodeResult.corruptFrames} corrupt · {campaign.decodeResult.unexpectedFrames} unexpected · {campaign.decodeResult.missingFrames} missing</small><small>{campaign.decodeResult.canonicalMatch ? 'Recovered bytes match the approved packet' : 'Recovered bytes do not match the approved packet'}</small>{campaign.decodeResult.reassembledDigest && <small>SHA-256 {campaign.decodeResult.reassembledDigest.slice(0, 24)}…</small>}</div>}<div className="broadcast-events">{(campaign.broadcastEvents ?? []).map((event) => <div key={event.eventId}><strong>{event.event}</strong><span>{formatDateTime(event.atMs)} · {event.operatorLabel}</span><code>{event.programId} · {event.artifactDigest.slice(0, 20)}…</code></div>)}</div></details></div>;
}

function WavePxEvidence({ campaign, frames, frameSource, decoded }: { campaign: Campaign; frames: readonly string[]; frameSource: 'tier2-mic' | 'tier2-direct'; decoded?: NonNullable<Campaign['decodeResult']>['decodedMessage'] }) {
  const sent = campaign.packetPreview;
  const recovered = decoded ?? campaign.decodeResult?.decodedMessage;
  const result = campaign.decodeResult;
  const sentPayload = sent?.payload ?? {};
  const recoveredPayload = recovered?.payload ?? {};
  const recoveredName = payloadName(recoveredPayload, recovered?.text);
  const effects = result?.mapOperations ?? [];
  const currentRecovered = frames.length || result?.recoveredFrames || 0;
  const expected = campaign.broadcastProgram?.uniqueFramesBase64.length ?? result?.expectedFrames ?? 0;
  const comparisonState = result?.canonicalMatch ? 'match' : result ? 'mismatch' : 'pending';

  return <section className="wavepx-evidence-register" aria-labelledby="wavepx-evidence-title">
    <header>
      <div><span>TRANSMISSION AND RECOVERY REGISTER</span><h3 id="wavepx-evidence-title">Complete WavePX packet evidence</h3><p>Supports public alerts, regional map records and safety check-ins. Recovered values below come from reassembled audio frames, not from the campaign draft.</p></div>
      <strong className={`evidence-verdict ${comparisonState}`}>{comparisonState === 'match' ? 'BYTE-IDENTICAL' : comparisonState === 'mismatch' ? 'NOT VERIFIED' : 'AWAITING DECODE'}</strong>
    </header>

    <div className="wavepx-evidence-columns">
      <article>
        <div className="evidence-column-title"><span>01 · Prepared transmission</span><strong>{campaign.title}</strong><small>Campaign title is station metadata; it is not claimed as recovered unless it also appears in the canonical payload.</small></div>
        <dl className="evidence-facts">
          <Fact label="Campaign type" value={campaignTypeName(campaign.dataType)} />
          <Fact label="Campaign ID / version" value={`${campaign.campaignId} · v${campaign.campaignVersion}`} />
          <Fact label="Packet type" value={`${sent?.typeName ?? `Type ${campaign.messageType}`} · ${sent?.family ?? 'Unknown family'}`} />
          <Fact label="Packet ID" value={campaign.packetId} />
          <Fact label="Message / record name" value={payloadName(sentPayload, campaign.summary)} />
          <Fact label="Region" value={campaign.regionCode} />
          <Fact label="Priority / severity" value={`${campaign.priority} / ${campaign.severity}`} />
          <Fact label="Instruction" value={instructionName(campaign.instruction)} />
          <Fact label="Canonical / WavePX bytes" value={`${sent?.totalBytes ?? '—'} / ${campaign.preview.totalTier2Bytes}`} />
          <Fact label="Audio profile" value={profileLabel(campaign.broadcastProgram?.profile ?? campaign.profile)} />
        </dl>
        <EvidencePayload title="Complete sent payload" payload={sentPayload} empty="Stored packet payload is still being reconstructed." />
      </article>

      <article>
        <div className="evidence-column-title"><span>02 · Recovered from audio</span><strong>{recovered ? recoveredName : 'No complete packet recovered yet'}</strong><small>{frameSource === 'tier2-mic' ? 'Current input: this browser microphone' : 'Current input: decoded WAV file'} · {currentRecovered}/{expected} unique expected frames</small></div>
        {recovered ? <>
          <dl className="evidence-facts">
            <Fact label="Recovered packet type" value={`${recovered.typeName ?? `Type ${recovered.messageType}`} · ${campaignTypeName(campaign.dataType)}`} />
            <Fact label="Recovered packet ID" value={recovered.packetId} />
            <Fact label="Recovered campaign" value={recovered.campaignId} />
            <Fact label="Recovered region" value={recovered.regionCode} />
            <Fact label="Recovered text / prompt" value={recovered.text || 'No display text in this packet type'} />
            <Fact label="Recovered language" value={recovered.language || 'Not carried'} />
            <Fact label="Recovered category" value={campaign.dataType === 'official-alert' ? alertCategoryName(recovered.category) : campaignTypeName(campaign.dataType)} />
            <Fact label="Recovered instruction" value={instructionName(recovered.instruction)} />
            <Fact label="Recovered point" value={coordinateText(recovered.location?.latE7, recovered.location?.lonE7)} />
            <Fact label="Decode time" value={result ? formatDateTime(result.testedAtMs) : 'Current unsaved recovery'} />
          </dl>
          <EvidencePayload title="Complete recovered payload" payload={recoveredPayload} empty="The packet carried no application payload fields." />
        </> : <div className="evidence-empty"><strong>Listening evidence will appear here.</strong><span>Recover every expected frame, then compare it. Partial frame counts remain visible without presenting the approved message as received.</span></div>}
      </article>
    </div>

    <div className="wavepx-comparison">
      <div><span>Canonical comparison</span><strong>{result?.canonicalMatch ? 'Recovered bytes equal the approved canonical packet' : result ? 'Recovered bytes did not rebuild the approved packet' : 'No persisted comparison yet'}</strong><small>{result ? `${result.recoveredFrames}/${result.expectedFrames} expected frames · ${result.missingFrames} missing · ${result.corruptFrames} corrupt · ${result.unexpectedFrames} unexpected` : `${frames.length}/${expected} frames currently collected`}</small></div>
      <div><span>Identity</span><strong>{result?.reassembledPacketId ?? 'Not recovered'}</strong><small>{result?.reassembledPacketId === campaign.packetId ? 'Packet identity preserved exactly' : 'Expected packet identity has not been confirmed'}</small></div>
      <div><span>Recovered digest</span><strong>{result?.reassembledDigest ?? 'Not available'}</strong><small>{result?.receiverLabel ? `${result.receiverLabel} · ${result.receptionTransport}` : 'Run a microphone or WAV comparison to create evidence'}</small></div>
    </div>

    <div className="wavepx-impact-register">
      <span>Decoded operational effect</span>
      {effects.length ? <ul>{effects.map((operation, index) => <li key={`${operation.kind}-${operation.causedByPacketId}-${index}`}><strong>{mapOperationLabel(operation)}</strong><small>{mapOperationDetail(operation)}</small><code>{operation.causedByPacketId}</code></li>)}</ul> : <div className="evidence-empty compact"><strong>No map mutation recovered</strong><span>Public instructions and check-in campaigns can decode successfully without changing a map object.</span></div>}
    </div>
  </section>;
}

function EvidencePayload({ title, payload, empty }: { title: string; payload: Record<string, unknown>; empty: string }) {
  const entries = Object.entries(payload);
  return <details className="evidence-payload" open><summary>{title} · {entries.length} field{entries.length === 1 ? '' : 's'}</summary>{entries.length ? <dl>{entries.map(([key, value]) => <div key={key}><dt>{humanFieldName(key)}</dt><dd>{evidenceValue(value)}</dd><code>{key}</code></div>)}</dl> : <p>{empty}</p>}</details>;
}

function payloadName(payload: Record<string, unknown>, fallback?: string): string {
  for (const key of ['fallbackLabel', 'fallbackInstruction', 'fallbackText', 'fallbackPrompt', 'formId', 'objectId', 'alertId', 'campaignId']) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return fallback?.trim() || 'Unnamed canonical packet';
}

function humanFieldName(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^./, (letter) => letter.toUpperCase());
}

function evidenceValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'Not carried';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return JSON.stringify(value, null, 2);
}

function PacketNetwork({ packets, gatewayAudit }: { packets: PacketStreamItem[]; gatewayAudit: GatewayAudit }) {
  const [selectedId, setSelectedId] = useState(packets[0]?.packetId ?? ''); const selected = packets.find((p) => p.packetId === selectedId) ?? packets[0];
  const counts = useMemo(() => ({ mesh: packets.filter((p) => p.direction === 'mesh-local').length, up: packets.filter((p) => p.direction === 'mesh-to-internet').length, down: packets.filter((p) => p.direction === 'internet-to-mesh').length, radio: packets.filter((p) => p.direction === 'radio-to-mesh').length }), [packets]);
  return <Page title="Packet network" meta="Counts reflect stored transport evidence. A queued packet is not counted as a radio broadcast or rescue outcome."><div className="network-path"><PathNode title="Mesh-local packets" count={counts.mesh} sub="Stored without gateway evidence" /><PathLink label="observed upload" /><PathNode title="Gateway-ingested packets" count={counts.up} sub="One or more stored observations" /><PathLink label="regional queue" /><PathNode title="Outbound mesh packets" count={counts.down} sub="Queued for IN-MH gateway delivery" /><PathLink label="decoded receiver" /><PathNode title="Radio-origin packets" count={counts.radio} sub="Tier 2 origin flag preserved" /></div><section className="panel gateway-register"><PanelHead title="Gateway synchronization register" aside={`${gatewayAudit.gateways.length} real registrations · ${gatewayAudit.transfers.length} stored transfers`} /><div className="gateway-grid">{gatewayAudit.gateways.map((gateway) => { const observations = gatewayAudit.observations.filter((item) => item.gatewayToken === gateway.gatewayToken); const transfers = gatewayAudit.transfers.filter((item) => item.gatewayToken === gateway.gatewayToken); const latest = transfers[0]; const uploads = transfers.filter((item) => item.direction === 'upload').reduce((sum, item) => sum + item.itemCount, 0); const downloads = transfers.filter((item) => item.direction === 'download').reduce((sum, item) => sum + item.itemCount, 0); return <article key={gateway.gatewayToken}><strong>{gateway.gatewayToken}</strong><span>Node {gateway.nodeToken} · {gateway.regionCode}</span><span>{uploads} uploaded · {downloads} downloaded · {observations.length} packet observations</span><span>{gateway.telemetry ? `${gateway.telemetry.queueDepth} relay queued · ${gateway.telemetry.storedPackets} stored · battery ${gateway.telemetry.batteryBand === undefined ? 'unavailable' : `${gateway.telemetry.batteryBand}/3`}` : 'Queue and battery telemetry unavailable'}</span><small>{gateway.lastSeenAtMs ? `Heartbeat ${formatDateTime(gateway.lastSeenAtMs)}` : latest ? `Last ${latest.direction} ${formatDateTime(latest.atMs)} · ${latest.itemCount} item${latest.itemCount === 1 ? '' : 's'}` : 'No heartbeat or synchronization transfer recorded'}</small></article>; })}{gatewayAudit.gateways.length === 0 && <Empty text="No phone has registered with this operations service." />}<aside>{gatewayAudit.outbound.map((queue) => <span key={queue.regionCode}><strong>{queue.regionCode}</strong><b>{queue.queued} queued</b></span>)}</aside></div></section><div className="network-grid"><section className="panel packet-table"><PanelHead title="Canonical packet stream" aside={`${packets.length} packets · refreshed every 3s`} /><div className="table packet"><div className="table-row head"><span>Packet / type</span><span>Direction</span><span>Source</span><span>Hops</span><span>Evidence</span></div>{packets.map((p) => <button key={p.packetId} className={selected?.packetId === p.packetId ? 'table-row active' : 'table-row'} onClick={() => setSelectedId(p.packetId)}><span><strong>{p.typeName}</strong><small>{shortId(p.packetId, 16)}</small></span><span><Direction value={p.direction} /></span><span>{p.sourceLabel}</span><span>{p.hopCount}/{p.hopLimit}</span><span>{p.observations.length} gateway observation{p.observations.length === 1 ? '' : 's'} · {p.totalBytes} B</span></button>)}</div></section><section className="panel inspector"><PanelHead title="Packet evidence" aside="Decoded · route · exact bytes" /><DataInspector packet={selected} /></section></div></Page>;
}

function Page({ title, meta, children }: { title: string; meta: string; children: ReactNode }) { return <section className="page"><header className="page-head"><h2>{title}</h2><p>{meta}</p></header>{children}</section>; }
function AccessGate({ onAuthenticated }: { onAuthenticated: (session: OperatorSession) => void }) {
  const [operatorLabel, setOperatorLabel] = useState(''); const [operationsKey, setOperationsKey] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(''); try { onAuthenticated(await api.authenticate(operatorLabel.trim(), operationsKey)); } catch (reason) { setError(errorText(reason)); } finally { setBusy(false); } };
  return <main className="access-shell"><section className="access-card" aria-labelledby="access-title"><div className="brand-mark"><span>NDON</span><i /></div><span className="jurisdiction">Mumbai deployment · IN-MH</span><h1 id="access-title">Operations access</h1><p>Enter the shared operations key and your operator name. Actions will be recorded under that name; this identifies an authorised session but is not cryptographic personal identity proof.</p><form onSubmit={submit}><label>Operator name<input autoComplete="name" value={operatorLabel} onChange={(event) => setOperatorLabel(event.target.value)} minLength={2} maxLength={48} required /></label><label>Operations key<input type="password" autoComplete="current-password" value={operationsKey} onChange={(event) => setOperationsKey(event.target.value)} required /></label>{error && <p className="field-error" role="alert">{error}</p>}<button className="button primary" disabled={busy}>{busy ? 'Checking access…' : 'Enter operations console'}</button></form></section></main>;
}
function PanelHead({ title, aside }: { title: string; aside: string }) { return <header className="panel-head"><h3>{title}</h3><span>{aside}</span></header>; }
function Empty({ text }: { text: string }) { return <div className="empty">{text}</div>; }
function Loading() { return <div className="loading"><i /><span>Loading operational ledger</span></div>; }
function Severity({ level }: { level: number }) { return <span className={`severity s${level}`}>S{level}</span>; }
function State({ value }: { value: string }) { return <span className={`state state-${value}`}>{value.replaceAll('-', ' ')}</span>; }
function Fact({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function Direction({ value }: { value: PacketStreamItem['direction'] }) { const label: Record<PacketStreamItem['direction'], string> = { 'mesh-local': 'Mesh local', 'mesh-to-internet': 'Mesh → Internet', 'internet-to-mesh': 'Internet → Mesh', 'radio-to-mesh': 'Radio → Mesh' }; return <span className={`direction ${value}`}>{label[value]}</span>; }
function PathNode({ title, count, sub }: { title: string; count: number; sub: string }) { return <div className="path-node"><strong>{title}</strong><b>{count}</b><small>{sub}</small></div>; }
function PathLink({ label }: { label: string }) { return <div className="path-link"><span>{label}</span><i>→</i></div>; }
function categoryName(value: number): string { return ['Medical', 'Trapped', 'Fire', 'Flood', 'Violence', 'Structural collapse', 'Missing person', 'Other'][value] ?? 'Emergency'; }
/** An alert's category is AlertCategory, not the incident category list. */
function alertCategoryName(value: number): string { return ['Evacuation', 'Shelter in place', 'Weather', 'Utility', 'Health', 'Security', 'All clear'][value] ?? `Category ${value}`; }
function flowName(value: string): string { return ({ draft: 'Draft', validated: 'Budget checked', approved: 'Authority approved', 'broadcaster-ready': 'Broadcast desk', 'audio-generated': 'Audio ready', 'decode-tested': 'Software decode passed', scheduled: 'Scheduled', played: 'Playback recorded', archived: 'Archived', failed: 'Failed' } as Record<string, string>)[value] ?? value; }
function campaignTypeName(value?: Campaign['dataType']): string { return ({ 'official-alert': 'Public alert', 'regional-record': 'Regional map record', 'check-in': 'Safety check-in' } as Record<string, string>)[value ?? 'official-alert'] ?? 'Public alert'; }
function campaignActionLabel(state: CampaignState): string { return state === 'validated' ? 'Check packet and airtime' : state === 'approved' ? 'Approve exact campaign packet' : state === 'scheduled' ? 'Schedule tested WavePX audio' : state === 'archived' ? 'Archive completed campaign' : `Move campaign to ${state}`; }
function campaignStepTitle(state: string): string { return ({ draft: 'Review the message and its effect', validated: 'Approve the exact packet', approved: 'Create the WavePX program', 'broadcaster-ready': 'Create the WavePX program', 'audio-generated': 'Decode-test the generated audio', 'decode-tested': 'Schedule the tested program', scheduled: 'Ready to transmit to phones', played: 'Transmission recorded', archived: 'Campaign complete', failed: 'Campaign needs attention' } as Record<string, string>)[state] ?? flowName(state); }
function campaignStepHelp(state: string): string { return ({ draft: 'Confirm the decoded message, packet identity and expected phone changes below.', validated: 'Approval locks this packet version and its digest. Any later update creates a new version and returns to review.', approved: 'Generate the acoustic frames and WAV tied to this approved packet.', 'broadcaster-ready': 'Generate the acoustic frames and WAV tied to this approved packet.', 'audio-generated': 'Use the station below to generate and decode the WAV before scheduling it.', 'decode-tested': 'The generated audio rebuilt the approved packet exactly. Schedule it when ready.', scheduled: 'Start WavePX listening on the phone, then transmit the scheduled campaign below.', played: 'The tested program was played and recorded. Archive it when operationally complete.', archived: 'This campaign remains available as read-only evidence.', failed: 'Return the campaign to draft and correct the message or audio plan.' } as Record<string, string>)[state] ?? 'Continue the campaign workflow.'; }
function instructionName(value: number): string { return ['No coded instruction', 'Evacuate now', 'Move to higher ground', 'Stay indoors', 'Boil water', 'Avoid area', 'Report to shelter', 'Await instruction'][value] ?? `Instruction ${value}`; }
function profileLabel(value: string): string { return ({ 'audible-normal': 'Audible · reliable', 'audible-fast': 'Audible · faster', 'ultrasound-normal': 'Near-ultrasonic' } as Record<string, string>)[value] ?? value; }
function mapOperationLabel(operation: DecodedMapOperation): string { return ({ 'upsert-resource': 'Add or update a map resource', 'set-resource-state': 'Change resource availability', 'set-capacity': 'Change resource capacity', 'upsert-hazard': 'Add or update a hazard', 'clear-hazard': 'Clear a hazard', 'set-route-state': 'Change a route', 'upsert-incident-marker': 'Add or move an incident', 'upsert-responder-marker': 'Add or move a responder', 'upsert-peer-marker': 'Update a nearby peer', 'set-incident-state': 'Change incident status', 'activate-content': 'Activate offline content', 'tombstone-object': 'Remove a map object' } as Record<string, string>)[operation.kind] ?? operation.kind.replaceAll('-', ' '); }
function mapOperationDetail(operation: DecodedMapOperation): string { const target = operation.objectId ?? String((operation as unknown as Record<string, unknown>)['hazardId'] ?? (operation as unknown as Record<string, unknown>)['routeId'] ?? 'regional map'); const state = operation.state === undefined ? '' : ` · state ${operation.state}`; const coordinate = typeof operation.latE7 === 'number' && typeof operation.lonE7 === 'number' ? ` · ${coordinateText(operation.latE7, operation.lonE7)}` : ''; return `${target}${state}${coordinate}`; }
function coordinateText(latE7?: number, lonE7?: number): string { return typeof latE7 === 'number' && typeof lonE7 === 'number' ? `${e7ToFloat(latE7).toFixed(5)}, ${e7ToFloat(lonE7).toFixed(5)}` : '—'; }
function mapOperationStatus(operations?: readonly { kind: string; objectId?: string; latE7?: number; lonE7?: number }[]): string { return operations?.length ? ` · Map operation: ${operations.map((operation) => `${operation.kind} ${operation.objectId ?? ''} at ${coordinateText(operation.latE7, operation.lonE7)}`).join(', ')}` : ''; }
function shortId(value: string, length = 10): string { return value.length > length ? `${value.slice(0, length)}…` : value; }
function formatDateTime(value: number): string { return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(value); }
function formatTimelineSeconds(value: number): string { return formatDateTime(TIME.DEMO_EPOCH_MS + value * 1000); }
function currentLocationAgeS(incident: Incident): number { const reportedAtS = incident.locationReportedAtS ?? incident.updatedAtS; const nowS = Math.floor((Date.now() - TIME.DEMO_EPOCH_MS) / 1000); return Math.max(0, nowS - reportedAtS + (incident.locationAgeS ?? 0)); }
function formatAge(seconds: number): string { if (seconds < 60) return `${seconds}s`; if (seconds < 3600) return `${Math.floor(seconds / 60)}m`; return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`; }
function responderActionLabel(action: 'accepted' | 'en-route' | 'arrived' | 'resolved'): string { return ({ accepted: 'Record acknowledgement', 'en-route': 'Record en route', arrived: 'Record arrival', resolved: 'Record resolution' })[action]; }
function kindGlyph(kind: string): string { return kind === 'shelter' ? 'S' : kind === 'medical' ? '+' : kind === 'route' ? 'R' : kind === 'hazard' ? '!' : kind === 'safe-zone' ? 'A' : 'D'; }
function gatewayLabel(nodeToken: string): string { return nodeToken.replace(/^mumbai-?/i, '').replaceAll('-', ' ').replace(/\b\w/g, (value) => value.toUpperCase()); }
const GATEWAY_ACTIVE_WINDOW_MS = 10 * 60_000;
function gatewayActivity(audit: GatewayAudit, token: string): { ageMs: number; uploads: number; downloads: number } {
  const gateway = audit.gateways.find((item) => item.gatewayToken === token);
  const transfers = audit.transfers.filter((item) => item.gatewayToken === token);
  const observationTimes = audit.observations.filter((item) => item.gatewayToken === token).map((item) => item.uploadedAtMs);
  const lastAtMs = Math.max(0, gateway?.lastSeenAtMs ?? 0, ...transfers.map((item) => item.atMs), ...observationTimes);
  return {
    ageMs: lastAtMs ? Math.max(0, Date.now() - lastAtMs) : Number.POSITIVE_INFINITY,
    uploads: transfers.filter((item) => item.direction === 'upload').reduce((sum, item) => sum + item.itemCount, 0),
    downloads: transfers.filter((item) => item.direction === 'download').reduce((sum, item) => sum + item.itemCount, 0),
  };
}
function latestRecordPacket(packets: PacketStreamItem[], objectId: string): PacketStreamItem | undefined {
  return packets
    .filter((packet) => packet.payload.objectId === objectId)
    .sort((left, right) => right.firstSeenAtMs - left.firstSeenAtMs)[0];
}
function directionShort(value: PacketStreamItem['direction']): string {
  return ({
    'mesh-local': 'Local mesh',
    'mesh-to-internet': 'Mesh upload',
    'internet-to-mesh': 'Gateway download',
    'radio-to-mesh': 'Radio receive',
  } as const)[value];
}
function CloseIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>; }
function errorText(reason: unknown): string { return reason instanceof Error ? reason.message : String(reason); }
