import { useEffect, useMemo, useState } from 'react';
import { DEPLOYMENT } from '@dsm/contracts';
import { e7ToFloat, floatToE7 } from './coordinates';
import { OperationsMap } from './OperationsMap';
import { DataInspector } from './DataInspector';
import type { PacketStreamItem, RegionalRecord } from './types';
import type { RegionalCentreInput } from './api';
import { isOperationallyUsable } from './operational-status';

interface Props {
  records: RegionalRecord[];
  packets: PacketStreamItem[];
  onPublish: (id: string, state: string) => void;
  onUpsert: (input: RegionalCentreInput) => void;
}

export function PublishWorkspace({ records, packets, onPublish, onUpsert }: Props) {
  const [selectedId, setSelectedId] = useState(records[0]?.objectId ?? '');
  const [query, setQuery] = useState('');
  const [selectedPacketId, setSelectedPacketId] = useState('');
  const selected = records.find((record) => record.objectId === selectedId) ?? records[0];
  const [nextState, setNextState] = useState(selected?.state ?? 'open');

  useEffect(() => setNextState(selected?.state ?? 'open'), [selected?.objectId, selected?.state]);

  const visibleRecords = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return records;
    return records.filter((record) => [record.name, record.district, record.kind, record.objectId, record.state].some((value) => value.toLowerCase().includes(term)));
  }, [query, records]);

  const relatedPackets = useMemo(() => packets
    .filter((packet) => packet.payload.objectId === selected?.objectId)
    .sort((a, b) => b.firstSeenAtMs - a.firstSeenAtMs), [packets, selected?.objectId]);
  const selectedPacket = relatedPackets.find((packet) => packet.packetId === selectedPacketId) ?? relatedPackets[0];

  return <section className="publish-workspace">
    <PublishHeader records={records} packets={packets} query={query} onQuery={setQuery} />
    <div className="publish-map-layout">
      <div className="publish-map-stage">
        <OperationsMap incidents={[]} records={visibleRecords} selected={selectedId} onSelect={setSelectedId} onQuickState={onPublish} />
      </div>
      <ObjectControl record={selected} nextState={nextState} packets={relatedPackets} onState={setNextState} onPublish={onPublish} onUpsert={onUpsert} />
    </div>
    <div className="publish-lower-deck">
      <RegionalRegister records={visibleRecords} selectedId={selectedId} onSelect={setSelectedId} />
      <DeliveryTrail packets={relatedPackets} selected={selected} selectedPacketId={selectedPacket?.packetId ?? ''} onSelect={setSelectedPacketId} />
    </div>
    {selectedPacket && <section className="publish-evidence"><header><span>SELECTED DELIVERY EVIDENCE</span><strong>{selected.name}</strong></header><DataInspector packet={selectedPacket} compact /></section>}
  </section>;
}

function PublishHeader({ records, packets, query, onQuery }: { records: RegionalRecord[]; packets: PacketStreamItem[]; query: string; onQuery: (value: string) => void }) {
  const unavailable = records.filter((record) => !isOperationallyUsable(record)).length;
  return <header className="publish-header">
    <div><span>MUMBAI REGIONAL PUBLISHING DESK</span><h2>Resources, hazards and routes</h2><small className="data-provenance">Prepared development records · online basemap · not a sourced facility register</small></div>
    <div className="publish-totals"><span><b>{records.length}</b> mapped objects</span><span><b>{unavailable}</b> restricted or active</span><span><b>{packets.filter((packet) => packet.outboundRegions.includes(DEPLOYMENT.regionCode)).length}</b> outbound packets</span></div>
    <label className="register-search"><span className="sr-only">Search mapped objects</span><input type="search" value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search centre, district, type or ID" /></label>
  </header>;
}

function ObjectControl({ record, nextState, packets, onState, onPublish, onUpsert }: { record?: RegionalRecord; nextState: string; packets: PacketStreamItem[]; onState: (state: string) => void; onPublish: (id: string, state: string) => void; onUpsert: (input: RegionalCentreInput) => void }) {
  if (!record) return <aside className="object-control"><div className="empty">Select an object on the map.</div></aside>;
  const latest = packets[0];
  const centre = !['hazard', 'route'].includes(record.kind);
  return <aside className="object-control">
    <header><span className={`object-symbol ${record.kind}`}>{kindGlyph(record.kind)}</span><div><span>{record.kind.replaceAll('-', ' ')} · {record.district}</span><h3>{record.name}</h3><code>{record.objectId}</code></div></header>
    <dl className="object-facts"><Fact label="Current state" value={record.state} /><Fact label="Record version" value={`v${record.version}`} /><Fact label="Latitude" value={e7ToFloat(record.latE7).toFixed(5)} /><Fact label="Longitude" value={e7ToFloat(record.lonE7).toFixed(5)} /></dl>
    <div className="state-control"><div><strong>Set operational state</strong><span>The map changes only after publication succeeds.</span></div><div className="state-options">{stateOptions(record.kind).map((state) => <button key={state} className={nextState === state ? `selected state-${state}` : ''} onClick={() => onState(state)}><i />{state}</button>)}</div></div>
    <button className="publish-action" disabled={nextState === record.state} onClick={() => onPublish(record.objectId, nextState)}><span>{nextState === record.state ? 'No unpublished change' : `Publish ${nextState}`}</span><small>{nextState === record.state ? `Current record is v${record.version}` : `Creates v${record.version + 1} · queues ${DEPLOYMENT.regionCode}`}</small></button>
    {centre && <CentreEditor record={record} onUpsert={onUpsert} />}
    <div className="latest-delivery"><div><strong>Latest delivery</strong><span>{latest ? directionLabel(latest.direction) : 'No packet for this object'}</span></div>{latest && <><div className="delivery-line"><span>Packet</span><code>{shortId(latest.packetId, 20)}</code></div><div className="delivery-line"><span>Gateway observations</span><b>{latest.observations.length}</b></div><div className="delivery-line"><span>Canonical size</span><b>{latest.totalBytes} B</b></div><div className="delivery-line"><span>Hop budget</span><b>{latest.hopCount}/{latest.hopLimit}</b></div></>}</div>
  </aside>;
}

function CentreEditor({ record, onUpsert }: { record: RegionalRecord; onUpsert: (input: RegionalCentreInput) => void }) {
  const [name, setName] = useState(record.name);
  const [district, setDistrict] = useState(record.district);
  const [lat, setLat] = useState(e7ToFloat(record.latE7).toFixed(7));
  const [lon, setLon] = useState(e7ToFloat(record.lonE7).toFixed(7));
  useEffect(() => { setName(record.name); setDistrict(record.district); setLat(e7ToFloat(record.latE7).toFixed(7)); setLon(e7ToFloat(record.lonE7).toFixed(7)); }, [record.objectId, record.version]);
  const build = (create: boolean): RegionalCentreInput | undefined => {
    const latE7 = floatToE7(Number(lat)); const lonE7 = floatToE7(Number(lon));
    if (!name.trim() || !district.trim() || !Number.isFinite(latE7) || !Number.isFinite(lonE7)) return undefined;
    return { ...(create ? {} : { objectId: record.objectId }), kind: record.kind as RegionalCentreInput['kind'], name: name.trim(), district: district.trim(), latE7, lonE7, state: record.state };
  };
  return <div className="centre-edit-form"><div><strong>Centre identity and position</strong><span>Publishes typed packet data; it does not redraw this map layout.</span></div><label>Name<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>District<input value={district} onChange={(event) => setDistrict(event.target.value)} /></label><label>Latitude<input inputMode="decimal" value={lat} onChange={(event) => setLat(event.target.value)} /></label><label>Longitude<input inputMode="decimal" value={lon} onChange={(event) => setLon(event.target.value)} /></label><div className="action-line"><button className="button secondary" onClick={() => { const input = build(false); if (input) onUpsert(input); }}>Publish move/edit</button><button className="button ghost" onClick={() => { const input = build(true); if (input) onUpsert(input); }}>Create temporary centre</button></div></div>;
}

function RegionalRegister({ records, selectedId, onSelect }: { records: RegionalRecord[]; selectedId: string; onSelect: (id: string) => void }) {
  return <section className="regional-register"><header><div><span>REGIONAL REGISTER</span><strong>{records.length} visible</strong></div><span>Select a row to locate it on the map</span></header><div className="regional-table"><div className="regional-row heading"><span>Object</span><span>District</span><span>Type</span><span>Status</span><span>Rev.</span></div>{records.map((record) => <button key={record.objectId} className={record.objectId === selectedId ? 'regional-row selected' : 'regional-row'} onClick={() => onSelect(record.objectId)}><span><strong>{record.name}</strong><small>{record.objectId}</small></span><span>{record.district}</span><span>{record.kind.replaceAll('-', ' ')}</span><span><i className={`status-mark state-${record.state}`} />{record.state}</span><span>v{record.version}</span></button>)}</div></section>;
}

function DeliveryTrail({ packets, selected, selectedPacketId, onSelect }: { packets: PacketStreamItem[]; selected?: RegionalRecord; selectedPacketId: string; onSelect: (id: string) => void }) {
  return <section className="delivery-trail"><header><span>PACKET TRAIL</span><strong>{selected?.objectId ?? 'No selection'}</strong></header>{packets.length === 0 ? <div className="empty">No packet has been published for this object.</div> : packets.slice(0, 6).map((packet) => <button className={packet.packetId === selectedPacketId ? 'selected' : ''} onClick={() => onSelect(packet.packetId)} key={packet.packetId}><span className={`packet-direction ${packet.direction}`}>{directionLabel(packet.direction)}</span><div><strong>{packet.typeName}</strong><code>{shortId(packet.packetId, 22)}</code></div><div><b>{packet.totalBytes} B</b><small>{packet.observations.length} gateway observation{packet.observations.length === 1 ? '' : 's'}</small></div></button>)}</section>;
}

function Fact({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function stateOptions(kind: string): string[] { if (kind === 'hazard') return ['active', 'watch', 'cleared']; if (kind === 'route') return ['open', 'restricted', 'blocked']; return ['open', 'full', 'closed', 'damaged']; }
function kindGlyph(kind: string): string { return kind === 'shelter' ? 'S' : kind === 'medical' ? '+' : kind === 'route' ? 'R' : kind === 'hazard' ? '!' : kind === 'safe-zone' ? 'A' : 'D'; }
function directionLabel(value: PacketStreamItem['direction']): string { return ({ 'mesh-local': 'Mesh local', 'mesh-to-internet': 'Mesh → Internet', 'internet-to-mesh': 'Internet → Mesh', 'radio-to-mesh': 'Radio → Mesh' })[value]; }
function shortId(value: string, length: number): string { return value.length > length ? `${value.slice(0, length)}…` : value; }
