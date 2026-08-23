import { useState } from 'react';
import { e7ToFloat } from '@dsm/codec';
import type { PacketStreamItem } from './types';

type InspectorView = 'decoded' | 'route' | 'raw';

export function DataInspector({ packet, compact = false }: { packet?: PacketStreamItem; compact?: boolean }) {
  const [view, setView] = useState<InspectorView>('decoded');
  const [copied, setCopied] = useState('');

  if (!packet) return <div className="empty">Select a packet to inspect its evidence.</div>;

  const copy = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(''), 1_600);
  };

  return <div className={compact ? 'data-inspector compact' : 'data-inspector'}>
    <div className="inspector-identity">
      <div><span>CANONICAL PACKET</span><code>{packet.packetId}</code></div>
      <button onClick={() => void copy('id', packet.packetId)}>{copied === 'id' ? 'Copied' : 'Copy ID'}</button>
    </div>
    <div className="inspector-tabs" role="tablist" aria-label="Packet evidence views">
      {(['decoded', 'route', 'raw'] as const).map((item) => <button key={item} role="tab" aria-selected={view === item} className={view === item ? 'active' : ''} onClick={() => setView(item)}>{item === 'raw' ? 'Raw bytes' : item}</button>)}
    </div>
    {view === 'decoded' && <div className="inspector-body">
      <dl className="evidence-grid">
        <Evidence label="Message" value={`${packet.typeName} · ${packet.type}`} />
        <Evidence label="Family" value={packet.family} />
        <Evidence label="Source" value={`${packet.sourceLabel} · class ${packet.sourceClass}`} />
        <Evidence label="Priority / severity" value={`${packet.priority} / ${packet.severity}`} />
        <Evidence label="Fragment" value={`${packet.fragmentIndex + 1} of ${packet.fragmentCount}`} />
        <Evidence label="Flags" value={`0x${packet.flags.toString(16).padStart(2, '0')}`} />
      </dl>
      <CodeBlock title="Decoded payload" value={JSON.stringify(packet.payload, null, 2)} copied={copied === 'payload'} onCopy={() => void copy('payload', JSON.stringify(packet.payload, null, 2))} />
    </div>}
    {view === 'route' && <div className="inspector-body">
      <dl className="evidence-grid">
        <Evidence label="Direction" value={directionLabel(packet.direction)} />
        <Evidence label="Hop budget" value={`${packet.hopCount} used · ${packet.hopLimit - packet.hopCount} remaining`} />
        <Evidence label="Created" value={formatEpoch(packet.createdAtS * 1_000)} />
        <Evidence label="Expires" value={formatEpoch(packet.expiresAtS * 1_000)} />
        <Evidence label="First stored" value={formatEpoch(packet.firstSeenAtMs)} />
        <Evidence label="Outbound regions" value={packet.outboundRegions.join(', ') || 'Not queued'} />
      </dl>
      {packet.geo && <dl className="evidence-grid geo"><Evidence label="Latitude" value={e7ToFloat(packet.geo.latE7).toFixed(6)} /><Evidence label="Longitude" value={e7ToFloat(packet.geo.lonE7).toFixed(6)} /><Evidence label="Accuracy" value={`±${packet.geo.accuracyM} m`} /><Evidence label="Scope" value={`${packet.geo.scopeRadiusM} m`} /></dl>}
      <div className="route-ledger"><h4>Gateway observations</h4>{packet.observations.length ? packet.observations.map((observation, index) => <article key={`${observation.gatewayToken}-${index}`}><i /><div><strong>{observation.gatewayToken}</strong><span>{observation.transport} · arrived at hop {observation.hopCountOnArrival}</span><small>Received {formatEpoch(observation.receivedAtMs)} · uploaded {formatEpoch(observation.uploadedAtMs)}</small></div></article>) : <p>No gateway has observed this packet.</p>}</div>
    </div>}
    {view === 'raw' && <div className="inspector-body">
      <dl className="evidence-grid"><Evidence label="Total bytes" value={`${packet.totalBytes} B`} /><Evidence label="Payload bytes" value={`${packet.payloadBytes} B`} /><Evidence label="SHA-256 digest" value={packet.digest} /><Evidence label="Digest prefix" value={packet.digestPrefix} /></dl>
      <CodeBlock title="Hexadecimal" value={packet.bytesHex} copied={copied === 'hex'} onCopy={() => void copy('hex', packet.bytesHex)} />
      <CodeBlock title="Base64" value={packet.bytesBase64} copied={copied === 'base64'} onCopy={() => void copy('base64', packet.bytesBase64)} />
    </div>}
  </div>;
}

function Evidence({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function CodeBlock({ title, value, copied, onCopy }: { title: string; value: string; copied: boolean; onCopy: () => void }) { return <section className="code-evidence"><header><h4>{title}</h4><button onClick={onCopy}>{copied ? 'Copied' : 'Copy'}</button></header><pre>{value}</pre></section>; }
function directionLabel(value: PacketStreamItem['direction']): string { return ({ 'mesh-local': 'Mesh local', 'mesh-to-internet': 'Mesh to internet', 'internet-to-mesh': 'Internet to mesh', 'radio-to-mesh': 'Radio to mesh' })[value]; }
function formatEpoch(value: number): string { return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'medium' }).format(value); }
