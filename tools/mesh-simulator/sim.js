/**
 * Disaster SOS Mesh — interactive simulator.
 *
 * This file is UI only. Every protocol decision on screen is made by the real
 * packages in engine.js: the codec builds the bytes, the validator runs the 15
 * gates, the policy engine makes the six decisions, the routing scheduler
 * scores forwarding, RadioMedium + SimulatedTransportAdapter + RelayLoop run
 * the eight session phases, GatewaySynchronizer runs the internet path, and
 * Tier2Receiver reassembles the ggwave frames.
 *
 * Nothing here reimplements any of that. Where this file makes something up —
 * pixel positions, the metres-per-pixel scale, the flight animation — it says so.
 */
(function () {
"use strict";

var D = window.DSM;
var C = D.contracts, CODEC = D.codec, VALIDATOR = D.validator, POLICY = D.policy,
    ROUTING = D.routing, TIER2 = D.tier2, TRANSPORT = D.transportCore, RUNTIME = D.nodeRuntime,
    GATEWAY_CLIENT = D.gatewayClient, MOBILE = D.mobile;

/* The Expo app's own screen list and readiness copy, imported not paraphrased. */
var SCREENS = MOBILE.screens.SCREENS;
var describeCapabilities = MOBILE.runtime.describeCapabilities;
var DELIVERY_STATE_COPY = C.DELIVERY_STATE_COPY;

var MessageType = C.MessageType, SourceClass = C.SourceClass, Severity = C.Severity,
    Priority = C.Priority, Flags = C.Flags, EmergencyCategory = C.EmergencyCategory,
    Mobility = C.Mobility, LocationSource = C.LocationSource, ReplyCapability = C.ReplyCapability,
    InstructionCode = C.InstructionCode, HazardType = C.HazardType, RouteState = C.RouteState,
    OperationalState = C.OperationalState, CapacityBand = C.CapacityBand,
    ResolutionOutcome = C.ResolutionOutcome, ArrivalEvidence = C.ArrivalEvidence,
    CancelReason = C.CancelReason, GeometryKind = C.GeometryKind,
    CLASS_BUDGETS = C.CLASS_BUDGETS, ENVELOPE = C.ENVELOPE, TIER2_LIMITS = C.TIER2,
    TIME = C.TIME, FRESHNESS = C.FRESHNESS;

var $ = function (s, r) { return (r || document).querySelector(s); };
var el = function (t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x !== undefined && x !== null) n.textContent = String(x); return n; };
var hex = function (u8) { var s = ""; for (var i = 0; i < u8.length; i++) s += u8[i].toString(16).padStart(2, "0"); return s; };
var REDUCED_MOTION = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

var TYPE_NAME = {};
Object.keys(MessageType).forEach(function (k) { TYPE_NAME[MessageType[k]] = k; });
var PRIORITY_NAME = []; Object.keys(Priority).forEach(function (k) { PRIORITY_NAME[Priority[k]] = k; });
var SEVERITY_NAME = []; Object.keys(Severity).forEach(function (k) { SEVERITY_NAME[Severity[k]] = k; });
var SOURCECLASS_NAME = []; Object.keys(SourceClass).forEach(function (k) { SOURCECLASS_NAME[SourceClass[k]] = k; });

/* ========================================================================== *
 * 1. World scale and geography — the only invented physics in the file.
 * ========================================================================== */

var VIEW_W = 1000, VIEW_H = 600;
/** Pixels to metres. Bluetooth in the open is optimistically ~100 m. */
var METRES_PER_UNIT = 1.1;
var REGIONS = [
  { id: "offline", label: "Region A — no coverage", sub: "towers down", x: 22, y: 44, w: 442, h: 512, internet: false },
  { id: "online",  label: "Region B — internet reachable", sub: "one working uplink", x: 536, y: 44, w: 442, h: 512, internet: true }
];

function regionAt(x, y) {
  for (var i = 0; i < REGIONS.length; i++) {
    var r = REGIONS[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r;
  }
  return null;
}

/** Deterministic RNG so a given seed replays identically. */
function seededRandom(seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ========================================================================== *
 * 2. Mock coordination backend — implements the frozen GatewayClient contract.
 *    It revalidates uploads with the SAME validator the phones use, and
 *    answers with real BACKEND_ACKNOWLEDGEMENT packets.
 * ========================================================================== */

function MockBackend(world) {
  this.world = world;
  this.sourceId = CODEC.newSourceId();
  this.received = new Map();     // packetId -> digest
  this.outbound = [];            // packets waiting to go back down to phones
  this.deliveredTo = new Map();  // gatewayToken -> Set(packetId)
  this.tokenSeq = 0;
  this.uploads = 0;
  this.acks = 0;
  this.batches = new Map();      // idempotency: batchId -> response
}

MockBackend.prototype.clientFor = function (node) {
  var backend = this, world = this.world;
  return {
    probe: function () {
      var reachable = world.backendPresent() && node.region() && node.region().internet;
      return Promise.resolve(reachable
        ? { proven: true, atMs: world.medium.clockMs, latencyMs: 40, backendIdentity: "sim-backend-1" }
        : { proven: false, atMs: world.medium.clockMs, failureReason: world.backendPresent() ? "no route from this region" : "no coordination centre in the world" });
    },
    register: function () {
      backend.tokenSeq += 1;
      var token = "gw-" + backend.tokenSeq;
      backend.deliveredTo.set(token, new Set());
      return Promise.resolve({ gatewayToken: token });
    },
    upload: function (request) {
      if (backend.batches.has(request.batchId)) return Promise.resolve(backend.batches.get(request.batchId));
      var results = [];
      for (var i = 0; i < request.items.length; i++) {
        results.push(backend.acceptUpload(request.items[i], node));
      }
      var response = { batchId: request.batchId, results: results, acceptedAtMs: world.medium.clockMs };
      backend.batches.set(request.batchId, response);
      backend.uploads += request.items.length;
      return Promise.resolve(response);
    },
    pollOutbound: function (request) {
      var seen = backend.deliveredTo.get(request.gatewayToken) || new Set();
      var items = [];
      for (var i = 0; i < backend.outbound.length && items.length < request.maxItems; i++) {
        var entry = backend.outbound[i];
        if (seen.has(entry.packetId)) continue;
        items.push({ packetId: entry.packetId, bytes: entry.bytes });
      }
      return Promise.resolve({
        items: items,
        nextCursor: items.length ? "c" + (backend.outbound.length) : undefined,
        hasMore: false
      });
    },
    ackOutbound: function (request) {
      var seen = backend.deliveredTo.get(request.gatewayToken) || new Set();
      request.packetIds.forEach(function (id) { seen.add(id); });
      backend.deliveredTo.set(request.gatewayToken, seen);
      return Promise.resolve();
    }
  };
};

/** The backend runs the same 15 gates. No privileged ingress (GTW-005). */
MockBackend.prototype.acceptUpload = function (item, viaNode) {
  var world = this.world;
  var nowS = CODEC.toEpochS(world.medium.clockMs);
  var known = this.received.get(item.packetId);

  var result = VALIDATOR.validate(item.bytes, {
    nowS: nowS,
    transport: "gateway",
    hopCountOnArrival: item.observation.hopCountOnArrival,
    isKnownDuplicate: known !== undefined,
    conflictingDigest: known,
    streamTerminated: false,
    storagePressure: "ok",
    queueDepth: this.received.size,
    maxQueueDepth: 5000,
    regionCode: world.regionCode
  });

  world.pushLog(null, {
    category: "gateway", name: known ? "backend-duplicate" : (result.ok ? "backend-accepted" : "backend-rejected"),
    severity: result.ok ? "info" : "warn", atMs: world.medium.clockMs,
    packetId: item.packetId, reason: result.ok ? undefined : result.reason,
    result: result.ok ? undefined : result.gate
  }, "coordination centre");

  if (!result.ok) return { packetId: item.packetId, outcome: "invalid", reason: result.reason };
  if (known) return { packetId: item.packetId, outcome: "duplicate" };

  this.received.set(item.packetId, result.digest);
  var receiptId = "BRC-" + (this.received.size);

  // A real BACKEND_ACKNOWLEDGEMENT, built by the real builder, queued to travel
  // back down. GTW-008: only this reaching the source phone may claim success.
  var ack = CODEC.buildBackendAck(
    { sourceId: this.sourceId, sourceClass: SourceClass.BACKEND, nowS: nowS },
    item.packetId,
    receiptId,
    C.BackendDedupOutcome.ACCEPTED_NEW,
    result.packet.streamId
  );
  this.outbound.push({ packetId: ack.packetId, bytes: ack.bytes });
  this.acks += 1;
  return { packetId: item.packetId, outcome: "accepted", backendReceiptId: receiptId };
};

/** Lets the operator publish an authority record straight from the centre. */
MockBackend.prototype.publish = function (encoded) {
  this.outbound.push({ packetId: encoded.packetId, bytes: encoded.bytes });
};

/* ========================================================================== *
 * 3. One simulated device.
 * ========================================================================== */

/*
 * ROL-001: the Expo app has exactly two local roles. Authority, coordinator and
 * radio-broadcaster are WEB roles (ROL-004) and are marked as such here, so the
 * simulator never implies the phone app can publish an official alert.
 */
var KINDS = {
  public:    { label: "Public phone",       role: "general-public", webRole: null,                 sourceClass: SourceClass.GENERAL_PUBLIC,        accent: "navy" },
  responder: { label: "Responder phone",    role: "responder",      webRole: null,                 sourceClass: SourceClass.RESPONDER_PROVISIONED, accent: "green" },
  authority: { label: "Authority console",  role: null,             webRole: "authority-publisher", sourceClass: SourceClass.AUTHORITY_PROVISIONED, accent: "saffron" },
  radio:     { label: "Radio station",      role: null,             webRole: "radio-broadcaster",   sourceClass: SourceClass.AUTHORITY_PROVISIONED, accent: "saffron" },
  backend:   { label: "Coordination centre", role: null,            webRole: "coordinator",         sourceClass: SourceClass.BACKEND,               accent: "plum" }
};

function SimNode(world, kind, x, y) {
  this.world = world;
  this.kind = kind;
  this.x = x; this.y = y;
  world.seq += 1;
  this.n = world.seq;
  this.id = kind + "-" + this.n;
  this.name = KINDS[kind].label + " " + String(this.n).padStart(2, "0");
  this.log = [];
  this.ingests = [];
  this.created = [];
  this.selected = false;

  if (kind === "backend") return;              // not a mesh participant
  if (kind === "radio") {                      // transmits audio only
    this.campaign = null;
    this.broadcast = null;
    return;
  }

  this.nodeToken = CODEC.newNodeToken();
  this.sourceId = CODEC.newSourceId();
  this.batteryBand = 3;
  this.listening = kind === "responder";       // Tier 2 microphone
  this.relayOn = true;

  var self = this;
  var sink = {
    emit: function (e) {
      self.log.push(e);
      if (self.log.length > 400) self.log.shift();
      world.pushLog(self, e);
    },
    recent: function (n) { return self.log.slice(-n).reverse(); },
    clear: function () { self.log.length = 0; }
  };

  this.adapter = new TRANSPORT.SimulatedTransportAdapter(this.nodeToken, world.medium);
  this.engine = new RUNTIME.NodeEngine({
    profile: {
      localUserId: this.id,
      role: KINDS[kind].role || "general-public",
      language: "en",
      responderProvisionedByDemo: kind === "responder"
    },
    localSourceId: this.sourceId,
    nodeToken: this.nodeToken,
    regionCode: world.regionCode,
    events: sink,
    now: function () { return world.medium.clockMs; }
  });
  this.engine.setCoarseLocation(Math.round(this.latE7()), Math.round(this.lonE7()));

  this.relay = new RUNTIME.RelayLoop({
    engine: this.engine,
    adapter: this.adapter,
    now: function () { return world.medium.clockMs; },
    gatewayProven: function () { return self.engine.isGatewayProven(world.medium.clockMs); }
  });

  this.gatewayClient = world.backend.clientFor(this);
  this.gateway = new RUNTIME.GatewaySynchronizer({
    engine: this.engine,
    client: this.gatewayClient,
    regionCode: world.regionCode,
    now: function () { return world.medium.clockMs; }
  });

  this.tier2 = new TIER2.Tier2Receiver();
  /* GTW-001 vocabulary: untested / unavailable / probing / proven. Never "connected". */
  this.gatewayState = new GATEWAY_CLIENT.GatewayStateTracker();

  /*
   * Observe every ingest so the inspector can show the gates and the policy
   * outcome for packets that arrived over Bluetooth, the radio or the gateway —
   * not just ones this device created. The real ingest still does all the work
   * and its result is passed through untouched; this only records a summary.
   */
  var realIngest = this.engine.ingest.bind(this.engine);
  this.engine.ingest = function (bytes, transport, meta) {
    return realIngest(bytes, transport, meta).then(function (result) {
      summariseIngest(self, bytes, transport, result);
      return result;
    });
  };

  // Transport events also drive the packet-flight animation on the canvas.
  this.adapter.addEventListener(function (ev) { world.onTransportEvent(self, ev); });
}

/**
 * Canvas position mapped onto real coordinates near Guwahati, so the packets
 * carry plausible geography and the policy engine's display-radius rule has
 * something real to measure. The mapping is presentation; the maths that uses
 * it is the real policy engine's.
 */
SimNode.prototype.latE7 = function () { return 262000000 - (this.y - VIEW_H / 2) * 900; };
SimNode.prototype.lonE7 = function () { return 917000000 + (this.x - VIEW_W / 2) * 900; };
SimNode.prototype.region = function () { return regionAt(this.x, this.y); };
SimNode.prototype.isMesh = function () { return this.kind !== "backend" && this.kind !== "radio"; };
SimNode.prototype.ctx = function () {
  return {
    sourceId: this.sourceId,
    sourceClass: KINDS[this.kind].sourceClass,
    nowS: CODEC.toEpochS(this.world.medium.clockMs)
  };
};
SimNode.prototype.location = function () {
  return {
    source: LocationSource.FRESH_GNSS,
    latE7: Math.round(this.latE7()),
    lonE7: Math.round(this.lonE7()),
    accuracyM: 12,
    ageS: 4
  };
};

/* ========================================================================== *
 * 4. The world.
 * ========================================================================== */

function World() {
  this.regionCode = "IN-AS-01";
  this.seq = 0;
  this.rangeUnits = 175;
  this.lossRate = 0;
  this.speed = 1;
  this.paused = false;
  this.medium = new TRANSPORT.RadioMedium({ lossRate: 0, latencyMs: 20, random: seededRandom(7) });
  this.nodes = new Map();
  this.links = new Set();
  this.flights = [];
  this.logLines = [];
  this.backend = new MockBackend(this);
  this.incidentSeq = 0;
  this.alertSeq = 0;
  this.tick = 0;
  this.started = false;
}

World.prototype.backendPresent = function () {
  var found = false;
  this.nodes.forEach(function (n) { if (n.kind === "backend") found = true; });
  return found;
};

World.prototype.add = function (kind, x, y) {
  var node = new SimNode(this, kind, x, y);
  this.nodes.set(node.id, node);
  if (node.isMesh() && this.started) node.relay.start().catch(function () {});
  this.pushLog(node, { category: "capability", name: "joined", severity: "info", atMs: this.medium.clockMs });
  return node;
};

World.prototype.remove = function (id) {
  var node = this.nodes.get(id);
  if (!node) return;
  if (node.isMesh()) {
    try { node.relay.stop(); } catch (e) { /* already stopped */ }
    var token = node.nodeToken, medium = this.medium;
    // RadioMedium has connect/disconnect but no unregister, so a removed device
    // is disconnected from every peer and then dropped from its two maps.
    medium.peersInRange(token).slice().forEach(function (p) { medium.disconnect(token, p); });
    medium.nodes.delete(token);
    medium.ranges.delete(token);
  }
  this.nodes.delete(id);
  var self = this;
  this.links.forEach(function (k) { if (k.indexOf(id) >= 0) self.links.delete(k); });
  this.pushLog(node, { category: "capability", name: "left", severity: "info", atMs: this.medium.clockMs });
};

World.prototype.node = function (id) { return this.nodes.get(id); };
World.prototype.list = function () { return Array.from(this.nodes.values()); };
World.prototype.meshNodes = function () { return this.list().filter(function (n) { return n.isMesh(); }); };

World.prototype.distance = function (a, b) { return Math.hypot(a.x - b.x, a.y - b.y); };

/**
 * Proximity drives the radio medium: in range means connected, out of range
 * means disconnected. This is the store-carry-forward scenario, live.
 */
World.prototype.updateProximity = function () {
  var mesh = this.meshNodes(), self = this;
  var next = new Set();
  for (var i = 0; i < mesh.length; i++) {
    for (var j = i + 1; j < mesh.length; j++) {
      var a = mesh[i], b = mesh[j];
      var key = a.id + "|" + b.id;
      var inRange = this.distance(a, b) <= this.rangeUnits;
      if (inRange) {
        next.add(key);
        if (!this.links.has(key)) {
          this.medium.connect(a.nodeToken, b.nodeToken);
          this.pushLog(a, { category: "peer-discovery", name: "in-range", severity: "debug",
            atMs: this.medium.clockMs, peerToken: b.nodeToken });
        }
      } else if (this.links.has(key)) {
        this.medium.disconnect(a.nodeToken, b.nodeToken);
        this.pushLog(a, { category: "peer-discovery", name: "out-of-range", severity: "debug",
          atMs: this.medium.clockMs, peerToken: b.nodeToken });
      }
    }
  }
  this.links = next;
};

World.prototype.onTransportEvent = function (node, ev) {
  if (ev.kind !== "record-sent") return;
  var peer = this.meshNodes().filter(function (n) { return n.nodeToken === ev.peerToken; })[0];
  if (!peer) return;
  this.flights.push({ from: node.id, to: peer.id, packetId: ev.packetId, bytes: ev.byteCount, at: performance.now() });
  if (this.flights.length > 40) this.flights.shift();
};

World.prototype.pushLog = function (node, event, label) {
  this.logLines.push({ who: label || (node ? node.name : "world"), whoId: node ? node.id : null, e: event });
  if (this.logLines.length > 600) this.logLines.splice(0, this.logLines.length - 600);
};

World.prototype.start = function () {
  this.started = true;
  var jobs = this.meshNodes().map(function (n) { return n.relay.start(); });
  return Promise.all(jobs);
};

/** One simulated step. Everything inside is the real engine doing the work. */
World.prototype.step = async function () {
  if (this.paused || this.stepping) return;
  this.stepping = true;
  try {
    await this.runStep();
  } finally {
    this.stepping = false;
  }
};

World.prototype.runStep = async function () {
  this.tick += 1;
  this.medium.options.lossRate = this.lossRate;

  this.updateProximity();

  var mesh = this.meshNodes();
  for (var i = 0; i < mesh.length; i++) {
    var n = mesh[i];
    n.engine.setBatteryBand(n.batteryBand);
    n.engine.setCoarseLocation(Math.round(n.latE7()), Math.round(n.lonE7()));
    if (n.relayOn && n.relay.isRunning) await n.relay.refreshAdvertisement();
  }
  await this.medium.advance(220 * this.speed);

  // Gateway cycle: probe, upload, download. Only a live probe may prove it.
  if (this.tick % 4 === 0) {
    for (var g = 0; g < mesh.length; g++) {
      var node = mesh[g];
      node.gatewayState.markProbing();
      try {
        var report = await node.gateway.sync();
        node.gatewayState.recordProbe({ proven: report.proven, atMs: this.medium.clockMs });
        if (report.uploaded) node.gatewayState.recordUpload(this.medium.clockMs);
        if (report.downloaded) node.gatewayState.recordDownload(this.medium.clockMs);
      } catch (e) {
        node.gatewayState.recordProbe({ proven: false, atMs: this.medium.clockMs });
      }
      node.gatewayState.setQueueDepth(await node.engine.packets.count());
    }
  }

  if (this.tick % 12 === 0) {
    for (var m = 0; m < mesh.length; m++) await mesh[m].engine.maintain(this.medium.clockMs);
  }

  await this.stepBroadcasts();
};

/* ---- Tier 2 broadcast progression ---------------------------------------- */

World.prototype.stepBroadcasts = async function () {
  var self = this;
  var towers = this.list().filter(function (n) { return n.kind === "radio" && n.broadcast; });
  for (var t = 0; t < towers.length; t++) {
    var tower = towers[t], b = tower.broadcast;
    if (b.index >= b.schedule.length) { tower.broadcast = null; continue; }
    var burst = b.schedule[b.index];
    b.index += 1;

    var listeners = this.meshNodes().filter(function (n) {
      return n.listening && self.distance(n, tower) <= tower.audioRange;
    });

    for (var f = 0; f < burst.frames.length; f++) {
      var frame = burst.frames[f];
      // The loss slider corrupts audio the way a noise burst would: one flipped
      // bit. The receiver's CRC-16 is what decides the frame is unusable.
      var wire = frame;
      if (this.lossRate > 0 && Math.random() < this.lossRate) {
        wire = frame.slice();
        wire[10 + (f % Math.max(1, wire.length - 12))] ^= 0x01;
      }
      for (var L = 0; L < listeners.length; L++) {
        var node = listeners[L];
        if (!node.tier2Resolver || node.tier2CampaignId !== tower.campaign.manifest.campaignId) {
          node.tier2 = new TIER2.Tier2Receiver(new TIER2.ManifestHandleResolver(tower.campaign.manifest, tower.campaignHandle));
          node.tier2.startListening("tier2-mic", this.medium.clockMs);
          node.tier2Resolver = true;
          node.tier2CampaignId = tower.campaign.manifest.campaignId;
        }
        var res = node.tier2.accept({ bytes: wire, source: "tier2-mic", receivedAtMs: this.medium.clockMs });
        this.pushLog(node, {
          category: "tier2", name: "frame", severity: res.reason === "tier2.frame-corrupt" ? "warn" : "debug",
          atMs: this.medium.clockMs, reason: res.reason, campaignId: tower.campaign.manifest.campaignId,
          bytes: wire.length
        });
        if (res.packet) {
          // The recovered packet enters through the SAME ingest as Bluetooth.
          await node.engine.ingest(res.packet.bytes, "tier2-mic", { campaignId: tower.campaign.manifest.campaignId });
        }
      }
    }
    tower.lastBurst = { at: performance.now(), packetId: burst.packetId, repeat: burst.repeatIndex };
    break; // one burst per tick keeps the schedule watchable
  }
};

function summariseIngest(node, bytes, transport, result) {
  var s = {
    at: node.world.medium.clockMs,
    transport: transport,
    bytes: bytes,
    accepted: result.accepted,
    packetId: result.packetId || null,
    storeOutcome: result.storeOutcome || null,
    validation: result.validation,
    policy: result.policy || null,
    mapOps: result.mapOperationsApplied
  };
  node.ingests.push(s);
  if (node.ingests.length > 25) node.ingests.shift();
  return s;
}

/* ========================================================================== *
 * 5. Actions — every one builds a real packet with a real builder.
 * ========================================================================== */

var ACTIONS = {
  sos: {
    label: "Send SOS", kinds: ["public", "responder"], accent: "bad",
    hint: "SOS_CREATE, severity LIFE_CRITICAL. Copy budget class CRITICAL.",
    run: function (node) {
      var w = node.world;
      w.incidentSeq += 1;
      var incidentId = "INC-" + String(w.incidentSeq).padStart(3, "0");
      var packet = CODEC.buildSosCreate(node.ctx(), {
        incidentId: incidentId,
        category: EmergencyCategory.TRAPPED,
        severity: Severity.LIFE_CRITICAL,
        peopleTotal: 3,
        injured: 1,
        mobility: Mobility.IMMOBILE,
        location: node.location(),
        replyCapabilities: ReplyCapability.TIER1_BLE,
        batteryBand: node.batteryBand
      });
      return { packet: packet, incidentId: incidentId };
    }
  },
  sosUpdate: {
    label: "SOS update", kinds: ["public", "responder"], needsOwnIncident: true,
    hint: "SOS_UPDATE with the next source sequence. Latest-wins; an older sequence is refused.",
    run: function (node, incidentId) {
      node.seqByIncident = node.seqByIncident || {};
      node.seqByIncident[incidentId] = (node.seqByIncident[incidentId] || 1) + 1;
      return {
        packet: CODEC.buildSosUpdate(node.ctx(), incidentId, node.seqByIncident[incidentId], Severity.LIFE_CRITICAL, {
          peopleTotal: 4, injured: 2, location: node.location()
        }),
        incidentId: incidentId
      };
    }
  },
  sosCancel: {
    label: "Cancel SOS", kinds: ["public", "responder"], needsOwnIncident: true,
    hint: "SOS_CANCEL is terminal: it suppresses active replication of the stream.",
    run: function (node, incidentId) {
      node.seqByIncident = node.seqByIncident || {};
      node.seqByIncident[incidentId] = (node.seqByIncident[incidentId] || 1) + 1;
      return {
        packet: CODEC.buildSosCancel(node.ctx(), incidentId, node.seqByIncident[incidentId], CancelReason.HELP_ARRIVED, 3600),
        incidentId: incidentId
      };
    }
  },
  accept: {
    label: "Accept case", kinds: ["responder"], needsIncident: true,
    hint: "RESPONDER_ACCEPTED. Only a responder or authority source class may create it.",
    run: function (node, incidentId) {
      return { packet: CODEC.buildResponderState(node.ctx(), MessageType.RESPONDER_ACCEPTED, incidentId, nextSeq(node, incidentId), {
        assignmentId: "ASG-" + incidentId.slice(-3), responderRef: "RSP-" + node.n
      }), incidentId: incidentId };
    }
  },
  enRoute: {
    label: "En route", kinds: ["responder"], needsIncident: true,
    hint: "RESPONDER_EN_ROUTE carries a coarse position and an ETA band, not a live track.",
    run: function (node, incidentId) {
      return { packet: CODEC.buildResponderState(node.ctx(), MessageType.RESPONDER_EN_ROUTE, incidentId, nextSeq(node, incidentId), {
        assignmentId: "ASG-" + incidentId.slice(-3), responderRef: "RSP-" + node.n, location: node.location(), etaBandMin: 15
      }), incidentId: incidentId };
    }
  },
  arrived: {
    label: "Arrived", kinds: ["responder"], needsIncident: true,
    hint: "RESPONDER_ARRIVED carries an evidence category. DECLARED is a claim, not a proof.",
    run: function (node, incidentId) {
      return { packet: CODEC.buildResponderState(node.ctx(), MessageType.RESPONDER_ARRIVED, incidentId, nextSeq(node, incidentId), {
        assignmentId: "ASG-" + incidentId.slice(-3), responderRef: "RSP-" + node.n, evidence: ArrivalEvidence.DECLARED
      }), incidentId: incidentId };
    }
  },
  resolve: {
    label: "Resolve", kinds: ["responder"], needsIncident: true,
    hint: "RESOLVED is terminal. It stops active replication and starts the tombstone window.",
    run: function (node, incidentId) {
      return { packet: CODEC.buildResponderState(node.ctx(), MessageType.RESOLVED, incidentId, nextSeq(node, incidentId), {
        resolverRef: "RSP-" + node.n, outcome: ResolutionOutcome.RESCUED, terminalRetentionS: 3600
      }), incidentId: incidentId };
    }
  },
  shelter: {
    label: "Open shelter", kinds: ["responder", "authority"],
    hint: "SHELTER is a map delta. Policy applies it to the projection; it does not alert.",
    run: function (node) {
      node.objSeq = (node.objSeq || 0) + 1;
      var objectId = "SHL-" + String(node.n) + String(node.objSeq).padStart(2, "0");
      return { packet: CODEC.buildResourceRecord(node.ctx(), MessageType.SHELTER, objectId, node.objSeq, {
        state: OperationalState.OPEN, capacityBand: CapacityBand.HALF,
        location: node.location(), fallbackLabel: "Relief camp " + objectId
      }) };
    }
  },
  hazard: {
    label: "Report hazard", kinds: ["public", "responder", "authority"],
    hint: "HAZARD from a public phone is flagged COMMUNITY_REPORTED and carries lower trust.",
    run: function (node) {
      node.hazSeq = (node.hazSeq || 0) + 1;
      var hazardId = "HAZ-" + node.n + String(node.hazSeq).padStart(2, "0");
      var community = node.kind === "public";
      var packet = CODEC.encodePacket({
        type: MessageType.HAZARD,
        payload: {
          hazardId: hazardId, hazardType: HazardType.FLOOD, geometryKind: GeometryKind.CIRCLE,
          latE7: Math.round(node.latE7()), lonE7: Math.round(node.lonE7()), radiusM: 400,
          fallbackLabel: "Rising water"
        },
        sourceId: node.sourceId,
        sourceClass: KINDS[node.kind].sourceClass,
        createdAt: CODEC.toEpochS(node.world.medium.clockMs),
        ttlS: CLASS_BUDGETS.MEDIUM_HIGH.ttlS,
        hopLimit: CLASS_BUDGETS.MEDIUM_HIGH.hopLimit,
        severity: Severity.URGENT,
        streamId: hazardId,
        sourceSequence: node.hazSeq,
        flags: community ? Flags.COMMUNITY_REPORTED : 0
      });
      return { packet: packet };
    }
  },
  routeClosed: {
    label: "Close a road", kinds: ["responder", "authority"],
    hint: "ROUTE_STATE carries a route ID and a reason code, never a sentence.",
    run: function (node) {
      node.rteSeq = (node.rteSeq || 0) + 1;
      var routeId = "NH37-" + node.n + node.rteSeq;
      return { packet: CODEC.buildRouteState(node.ctx(), routeId, node.rteSeq, {
        state: RouteState.BLOCKED, reasonCode: 3, fallbackInstruction: "Use the embankment road"
      }) };
    }
  },
  alert: {
    label: "Official alert", kinds: ["authority"], accent: "saffron",
    hint: "OFFICIAL_ALERT. Priority AUTHORITY_CRITICAL, and only a privileged source class may create it.",
    run: function (node) {
      var w = node.world;
      w.alertSeq += 1;
      var alertId = "ALT-" + String(w.alertSeq).padStart(3, "0");
      return { packet: CODEC.buildOfficialAlert(node.ctx(), alertId, 1, Severity.URGENT, {
        category: 0, instruction: InstructionCode.MOVE_TO_HIGHER_GROUND,
        regionCode: w.regionCode, latE7: Math.round(node.latE7()), lonE7: Math.round(node.lonE7()),
        radiusM: 5000, fallbackText: "Move to higher ground now"
      }) };
    }
  },
  forgeAlert: {
    label: "Forge an alert", kinds: ["public"], accent: "bad",
    hint: "A well-formed OFFICIAL_ALERT from a general-public source class. Watch gate 12 refuse it at every peer.",
    run: function (node) {
      var w = node.world;
      w.alertSeq += 1;
      var alertId = "ALT-FAKE-" + w.alertSeq;
      return { packet: CODEC.encodePacket({
        type: MessageType.OFFICIAL_ALERT,
        payload: { alertId: alertId, category: 0, instruction: InstructionCode.EVACUATE_NOW,
          regionCode: w.regionCode, fallbackText: "Evacuate immediately" },
        sourceId: node.sourceId,
        sourceClass: SourceClass.GENERAL_PUBLIC,
        createdAt: CODEC.toEpochS(w.medium.clockMs),
        ttlS: CLASS_BUDGETS.HIGH.ttlS,
        hopLimit: CLASS_BUDGETS.HIGH.hopLimit,
        severity: Severity.URGENT,
        streamId: alertId,
        sourceSequence: 1
      }) };
    }
  },
  checkin: {
    label: "Check-in campaign", kinds: ["authority"],
    hint: "CHECKIN_CAMPAIGN opens a form on receiving phones. Responses travel back as Tier 1 packets.",
    run: function (node) {
      var w = node.world;
      w.alertSeq += 1;
      var id = "CHK-" + w.alertSeq;
      return { packet: CODEC.buildCheckinCampaign(node.ctx(), id, {
        campaignVersion: 1, formId: 1, deadlineS: CODEC.toEpochS(w.medium.clockMs) + 7200,
        regionCode: w.regionCode, requestPeopleCount: true, requestLocation: true,
        fallbackPrompt: "Are you safe?"
      }) };
    }
  }
};

function nextSeq(node, incidentId) {
  node.seqByIncident = node.seqByIncident || {};
  node.seqByIncident[incidentId] = (node.seqByIncident[incidentId] || 1) + 1;
  return node.seqByIncident[incidentId];
}

async function runAction(node, key, incidentId) {
  var action = ACTIONS[key];
  var built;
  try {
    built = action.run(node, incidentId);
  } catch (err) {
    // e.g. buildOfficialAlert refuses a non-authority source class outright.
    node.world.pushLog(node, { category: "validation", name: "refused-at-source", severity: "error",
      atMs: node.world.medium.clockMs, reason: String(err.message || err) });
    return null;
  }
  await node.engine.createLocal(built.packet, built.incidentId);
  node.created.push({ packetId: built.packet.packetId, bytes: built.packet.bytes, at: node.world.medium.clockMs, action: key });
  if (node.created.length > 40) node.created.shift();
  UI.selectPacket(built.packet.bytes, node);
  return built.packet;
}

/* ---- Tier 2 campaign ------------------------------------------------------ */

async function buildCampaign(tower) {
  var w = tower.world;
  // Collect the authority records currently in the world worth broadcasting.
  var pool = [];
  w.list().forEach(function (n) {
    if (!n.created) return;
    n.created.forEach(function (c) {
      var d = CODEC.decodePacket(c.bytes);
      if (!d.ok) return;
      var t = d.packet.header.type;
      var privileged = d.packet.header.sourceClass === SourceClass.AUTHORITY_PROVISIONED ||
                       d.packet.header.sourceClass === SourceClass.BACKEND;
      if (!privileged) return;
      if (t === MessageType.OFFICIAL_ALERT || t === MessageType.ROUTE_STATE ||
          t === MessageType.SHELTER || t === MessageType.WEATHER_BULLETIN ||
          t === MessageType.CHECKIN_CAMPAIGN) {
        pool.push({ packetId: c.packetId, bytes: c.bytes, messageType: t,
          priority: d.packet.header.priority, severity: d.packet.header.severity });
      }
    });
  });
  if (pool.length === 0) return { error: "No authority records to broadcast yet. Add an authority console and publish an alert first." };

  var byId = new Map();
  pool.forEach(function (p) { byId.set(p.packetId, p); });
  var packets = Array.from(byId.values()).slice(0, TIER2_LIMITS.MAX_CAMPAIGN_PACKETS);

  tower.campaignSeq = (tower.campaignSeq || 0) + 1;
  tower.campaignHandle = tower.n * 100 + tower.campaignSeq;
  var nowS = CODEC.toEpochS(w.medium.clockMs);
  var plan;
  try {
    plan = TIER2.planCampaign({
      campaignId: "CMP-" + tower.n + "-" + tower.campaignSeq,
      campaignVersion: 1,
      campaignHandle: tower.campaignHandle,
      regionCode: w.regionCode,
      validFromS: nowS,
      validUntilS: nowS + 3600,
      requiredPackId: "PACK-ASSAM",
      requiredPackVersion: 1,
      profile: tower.profile || "audible-fast",
      packets: packets
    });
  } catch (err) {
    return { error: String(err.message || err) };
  }

  // Frames per packet, then the real interleaved burst schedule.
  var framesByHandle = new Map();
  packets.forEach(function (p, i) {
    framesByHandle.set(p.packetId, TIER2.toTier2Frames({
      campaignHandle: tower.campaignHandle, campaignVersion: 1, packetHandle: i + 1,
      messageType: p.messageType, priority: p.priority, severity: p.severity,
      payload: p.bytes.subarray(ENVELOPE.HEADER_BYTES)
    }));
  });
  var schedule = plan.manifest.burstSchedule.map(function (b) {
    return { packetId: b.packetId, repeatIndex: b.repeatIndex, frames: framesByHandle.get(b.packetId) };
  });

  tower.campaign = plan;
  return { plan: plan, schedule: schedule };
}

/* ========================================================================== *
 * 6. UI
 * ========================================================================== */

var world = new World();
var UI = {
  selected: null,        // node id
  dragging: null,
  packet: null,          // { bytes, ownerId }
  view: "envelope",
  sel: null,             // selected byte offset
  tab: "device",
  logFilter: "all",
  policyKey: null,
  incident: null
};

/* ---- palette / world controls -------------------------------------------- */

function renderPalette() {
  var box = $("#palette");
  box.innerHTML = "";

  var add = el("div", "pane");
  add.appendChild(el("h3", null, "Add a device"));
  var grid = el("div", "add-grid");
  [["public", "Public phone", "Carries and relays. Can report."],
   ["responder", "Responder", "Sees SOS in full. Can accept and resolve."],
   ["authority", "Authority console", "Publishes alerts, shelters, campaigns."],
   ["radio", "Radio station", "Broadcasts a Tier 2 ggwave campaign."],
   ["backend", "Coordination centre", "The internet endpoint. One is enough."]].forEach(function (k) {
    var b = el("button", "add-btn");
    b.appendChild(el("span", "ab-dot " + KINDS[k[0]].accent));
    var t = el("span", "ab-text");
    t.appendChild(el("b", null, k[1]));
    t.appendChild(el("small", null, k[2]));
    b.appendChild(t);
    b.onclick = function () { addNodeInteractively(k[0]); };
    if (k[0] === "backend" && world.backendPresent()) { b.disabled = true; b.title = "already in the world"; }
    grid.appendChild(b);
  });
  add.appendChild(grid);
  box.appendChild(add);

  var ctrl = el("div", "pane");
  ctrl.appendChild(el("h3", null, "World"));
  ctrl.appendChild(slider("Radio range", world.rangeUnits, 60, 380, 5,
    function (v) { world.rangeUnits = v; }, function (v) { return Math.round(v * METRES_PER_UNIT) + " m"; }));
  ctrl.appendChild(slider("Packet loss", world.lossRate * 100, 0, 60, 1,
    function (v) { world.lossRate = v / 100; }, function (v) { return Math.round(v) + " %"; }));
  ctrl.appendChild(slider("Speed", world.speed, 0.25, 4, 0.25,
    function (v) { world.speed = v; }, function (v) { return v + "×"; }));
  box.appendChild(ctrl);

  var app = el("div", "pane");
  var built = SCREENS.filter(function (x) { return x.status === "complete"; }).length;
  var partial = SCREENS.filter(function (x) { return x.status === "partial"; }).length;
  app.appendChild(el("h3", null, "The Expo app"));
  var appCard = el("div", "card");
  appCard.appendChild(el("div", "sub-head", built + " of " + SCREENS.length + " screens built"));
  var sl = el("div", "rows");
  SCREENS.forEach(function (sc) {
    var r = el("div", "row");
    r.appendChild(el("span", "k", sc.title));
    var v = el("span", "v", sc.status);
    v.style.color = sc.status === "complete" ? "var(--green)" : sc.status === "partial" ? "var(--warn)" : "var(--ink-3)";
    r.title = sc.requirements.join(", ");
    r.appendChild(v);
    sl.appendChild(r);
  });
  appCard.appendChild(sl);
  app.appendChild(appCard);
  app.appendChild(el("p", "note",
    "Read live from the app's screen-registry.ts. The engine below the screens is built and is what this page runs; "
    + (partial + built === 0 ? "the screens themselves are still scaffolds." : "the screens are partly built.")
    + " Stock Expo Go drives the same engine over a simulated transport; real Bluetooth needs a development build."));
  box.appendChild(app);

  var pre = el("div", "pane");
  pre.appendChild(el("h3", null, "Scenarios"));
  var lastGroup = null;
  PRESETS.forEach(function (p) {
    if (p.group !== lastGroup) {
      lastGroup = p.group;
      pre.appendChild(el("div", "group-label", p.group));
    }
    var b = el("button", "preset");
    b.setAttribute("aria-pressed", String(world.scenario === p));
    b.appendChild(el("b", null, p.name));
    b.appendChild(el("small", null, p.blurb));
    b.onclick = function () { loadPreset(p); };
    pre.appendChild(b);
  });
  box.appendChild(pre);
}

function slider(label, value, min, max, stepv, onInput, fmt) {
  var wrap = el("label", "slider");
  var top = el("span", "s-top");
  top.appendChild(el("span", null, label));
  var out = el("b", null, fmt(value));
  top.appendChild(out);
  wrap.appendChild(top);
  var input = document.createElement("input");
  input.type = "range"; input.min = min; input.max = max; input.step = stepv; input.value = value;
  input.oninput = function () { var v = parseFloat(input.value); out.textContent = fmt(v); onInput(v); renderCanvas(); };
  wrap.appendChild(input);
  return wrap;
}

/* ---- canvas --------------------------------------------------------------- */

function renderCanvas() {
  var svg = $("#stage");
  var parts = [];

  REGIONS.forEach(function (r) {
    parts.push('<rect class="region ' + (r.internet ? "on" : "off") + '" x="' + r.x + '" y="' + r.y + '" width="' + r.w + '" height="' + r.h + '" rx="10"/>');
    parts.push('<text class="region-label" x="' + (r.x + 14) + '" y="' + (r.y + 22) + '">' + r.label + '</text>');
    parts.push('<text class="region-sub" x="' + (r.x + 14) + '" y="' + (r.y + 36) + '">' + r.sub + '</text>');
  });
  parts.push('<text class="gap-label" x="' + VIEW_W / 2 + '" y="' + (VIEW_H - 8) + '" text-anchor="middle">drag a phone across the gap to carry packets between regions</text>');

  // range ring on the selected device
  var sel = UI.selected ? world.node(UI.selected) : null;
  if (sel && sel.isMesh()) {
    parts.push('<circle class="range" cx="' + sel.x + '" cy="' + sel.y + '" r="' + world.rangeUnits + '"/>');
  }
  world.list().forEach(function (n) {
    if (n.kind === "radio") {
      parts.push('<circle class="audio-range" cx="' + n.x + '" cy="' + n.y + '" r="' + n.audioRange + '"/>');
    }
  });

  // links
  world.links.forEach(function (key) {
    var ids = key.split("|");
    var a = world.node(ids[0]), b = world.node(ids[1]);
    if (!a || !b) return;
    parts.push('<line class="link" x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '"/>');
  });

  // gateway uplinks
  var backend = world.list().filter(function (n) { return n.kind === "backend"; })[0];
  if (backend) {
    world.meshNodes().forEach(function (n) {
      if (n.engine.isGatewayProven(world.medium.clockMs)) {
        parts.push('<line class="uplink" x1="' + n.x + '" y1="' + n.y + '" x2="' + backend.x + '" y2="' + backend.y + '"/>');
      }
    });
  }

  // packets in flight (driven by real record-sent transport events)
  var now = performance.now();
  world.flights = world.flights.filter(function (f) { return now - f.at < 900; });
  if (!REDUCED_MOTION) {
    world.flights.forEach(function (f) {
      var a = world.node(f.from), b = world.node(f.to);
      if (!a || !b) return;
      var t = Math.min(1, (now - f.at) / 900);
      parts.push('<circle class="flight" cx="' + (a.x + (b.x - a.x) * t) + '" cy="' + (a.y + (b.y - a.y) * t) + '" r="4"/>');
    });
  }

  // audio bursts
  world.list().forEach(function (n) {
    if (n.kind !== "radio" || !n.lastBurst) return;
    var age = now - n.lastBurst.at;
    if (age > 1200) return;
    var r = 28 + (age / 1200) * (n.audioRange - 28);
    parts.push('<circle class="burst" cx="' + n.x + '" cy="' + n.y + '" r="' + r + '" opacity="' + (1 - age / 1200) * 0.55 + '"/>');
  });

  // devices
  world.list().forEach(function (n) { parts.push(deviceSvg(n)); });

  svg.innerHTML = parts.join("");
}

function deviceSvg(n) {
  var k = KINDS[n.kind];
  var selected = UI.selected === n.id;
  var out = '<g class="dev ' + k.accent + (selected ? " sel" : "") + '" data-id="' + n.id + '" transform="translate(' + n.x + ',' + n.y + ')">';
  if (n.kind === "radio") {
    out += '<path class="dev-body" d="M-20 12 L0 -14 L20 12 Z"/>';
  } else if (n.kind === "backend") {
    out += '<rect class="dev-body" x="-22" y="-14" width="44" height="28" rx="3"/><line class="dev-line" x1="-14" y1="-4" x2="14" y2="-4"/><line class="dev-line" x1="-14" y1="4" x2="14" y2="4"/>';
  } else if (n.kind === "authority") {
    out += '<rect class="dev-body" x="-20" y="-15" width="40" height="30" rx="3"/><line class="dev-line" x1="-11" y1="15" x2="11" y2="15"/>';
  } else {
    out += '<rect class="dev-body" x="-13" y="-18" width="26" height="36" rx="4"/>';
  }
  // state pips
  if (n.isMesh()) {
    if (n.engine.isGatewayProven(world.medium.clockMs)) out += '<circle class="pip gw" cx="14" cy="-16" r="4"/>';
    if (n.listening) out += '<circle class="pip ear" cx="-14" cy="-16" r="4"/>';
    if (!n.relayOn) out += '<circle class="pip off" cx="14" cy="16" r="4"/>';
  }
  out += '<text class="dev-name" y="30" text-anchor="middle">' + shortName(n) + '</text>';
  if (n.isMesh()) out += '<text class="dev-sub" y="41" text-anchor="middle">' + n.nodeToken + '</text>';
  out += "</g>";
  return out;
}
function shortName(n) {
  var map = { public: "Phone", responder: "Responder", authority: "Authority", radio: "Radio", backend: "Centre" };
  return map[n.kind] + " " + String(n.n).padStart(2, "0");
}

/* ---- adding and dragging --------------------------------------------------- */

function freeSpot() {
  for (var attempt = 0; attempt < 200; attempt++) {
    var r = REGIONS[attempt % 2];
    var x = r.x + 60 + Math.random() * (r.w - 120);
    var y = r.y + 60 + Math.random() * (r.h - 120);
    var clear = true;
    world.list().forEach(function (n) { if (Math.hypot(n.x - x, n.y - y) < 70) clear = false; });
    if (clear) return { x: x, y: y };
  }
  return { x: VIEW_W / 2, y: VIEW_H / 2 };
}

function addNodeInteractively(kind) {
  var spot = freeSpot();
  if (kind === "backend") { spot = { x: REGIONS[1].x + REGIONS[1].w - 60, y: REGIONS[1].y + 46 }; }
  if (kind === "radio") { spot = { x: VIEW_W / 2, y: 90 }; }
  var node = world.add(kind, spot.x, spot.y);
  if (kind === "radio") { node.audioRange = 260; node.profile = "audible-fast"; }
  UI.selected = node.id;
  renderAll();
}

function stagePoint(evt) {
  var svg = $("#stage");
  var rect = svg.getBoundingClientRect();
  return {
    x: ((evt.clientX - rect.left) / rect.width) * VIEW_W,
    y: ((evt.clientY - rect.top) / rect.height) * VIEW_H
  };
}

function bindStage() {
  var svg = $("#stage");
  svg.addEventListener("pointerdown", function (e) {
    var g = e.target.closest ? e.target.closest(".dev") : null;
    if (!g) { UI.selected = null; renderAll(); return; }
    var id = g.getAttribute("data-id");
    UI.selected = id;
    UI.dragging = id;
    svg.setPointerCapture(e.pointerId);
    renderAll();
  });
  svg.addEventListener("pointermove", function (e) {
    if (!UI.dragging) return;
    var n = world.node(UI.dragging);
    if (!n) return;
    var p = stagePoint(e);
    n.x = Math.max(24, Math.min(VIEW_W - 24, p.x));
    n.y = Math.max(24, Math.min(VIEW_H - 24, p.y));
    world.updateProximity();
    renderCanvas();
    renderInspector();
  });
  svg.addEventListener("pointerup", function (e) {
    if (UI.dragging) { UI.dragging = null; try { svg.releasePointerCapture(e.pointerId); } catch (x) {} renderAll(); }
  });
  svg.addEventListener("pointercancel", function () { UI.dragging = null; });
}

/* ---- inspector ------------------------------------------------------------- */

function renderInspector() {
  var head = $("#insp-head"), body = $("#insp-body");
  head.innerHTML = ""; body.innerHTML = "";
  var n = UI.selected ? world.node(UI.selected) : null;

  if (!n) {
    head.appendChild(el("h2", null, "Nothing selected"));
    body.appendChild(el("p", "empty", "Add a device on the left, then click it here. Drag devices to move them: inside the radio range they connect, outside it they disconnect and carry what they hold."));
    return;
  }

  head.appendChild(el("h2", null, n.name));
  var tabs = el("div", "tabs");
  /* Tab names mirror the app's screen registry so the mapping is obvious. */
  var available = n.isMesh()
    ? [["device", "Readiness"], ["packet", "Packet"], ["gates", "Diagnostics"], ["incidents", "Active SOS"]]
    : (n.kind === "radio" ? [["radio", "Tier 2"], ["packet", "Packet"]] : [["centre", "Centre"], ["packet", "Packet"]]);
  var valid = available.map(function (t) { return t[0]; });
  if (valid.indexOf(UI.tab) < 0) UI.tab = valid[0];
  available.forEach(function (t) {
    var b = el("button", null, t[1]);
    b.setAttribute("aria-pressed", String(UI.tab === t[0]));
    b.onclick = function () { UI.tab = t[0]; renderInspector(); };
    tabs.appendChild(b);
  });
  head.appendChild(tabs);

  var del = el("button", "btn ghost danger", "Remove");
  del.onclick = function () { world.remove(n.id); UI.selected = null; renderAll(); };
  head.appendChild(del);

  if (UI.tab === "device") renderDeviceTab(body, n);  // Readiness + Relay status
  else if (UI.tab === "packet") renderPacketTab(body);
  else if (UI.tab === "gates") renderGatesTab(body, n);
  else if (UI.tab === "incidents") renderIncidentsTab(body, n);
  else if (UI.tab === "radio") renderRadioTab(body, n);
  else if (UI.tab === "centre") renderCentreTab(body, n);
}

function rowsCard(pairs) {
  var c = el("div", "card"), rs = el("div", "rows");
  pairs.forEach(function (p) {
    if (!p) return;
    var r = el("div", "row");
    r.appendChild(el("span", "k", p[0]));
    var v = el("span", "v", p[1]);
    if (p[2]) v.style.color = "var(--" + p[2] + ")";
    r.appendChild(v);
    rs.appendChild(r);
  });
  c.appendChild(rs);
  return c;
}

function renderDeviceTab(body, n) {
  var region = n.region();
  var proven = n.engine.isGatewayProven(world.medium.clockMs);
  var peers = world.links.size ? Array.from(world.links).filter(function (k) { return k.indexOf(n.id) >= 0; }).length : 0;

  var gw = n.gatewayState.current(world.medium.clockMs);
  var k = KINDS[n.kind];
  body.appendChild(rowsCard([
    ["local role", k.role || "— web role: " + k.webRole],
    ["source class", SOURCECLASS_NAME[k.sourceClass]],
    ["node token", n.nodeToken],
    ["source id", n.sourceId],
    ["region", region ? region.label.split("—")[0].trim() : "between regions"],
    ["internet", gw.state, gw.state === "proven" ? "green" : "ink-3"],
    ["peers in range", String(peers)],
    ["queue epoch", String(n.engine.currentQueueEpoch)]
  ]));

  // The Readiness screen's own words (DEC-004, working rule 11).
  var rd = el("div", "block");
  rd.appendChild(el("h3", null, "Readiness"));
  var rdCard = el("div", "card");
  rdCard.appendChild(el("div", "row empty-row", "reading capabilities\u2026"));
  rd.appendChild(rdCard);
  rd.appendChild(el("p", "note", "These lines come from the app's own describeCapabilities(). Stock Expo Go reports simulated: true and the readiness screen renders it verbatim — no runtime may soften it."));
  body.appendChild(rd);
  n.adapter.getCapabilities().then(function (report) {
    rdCard.innerHTML = "";
    var rows = el("div", "rows");
    describeCapabilities(report).forEach(function (line) {
      var idx = line.indexOf(":");
      var r = el("div", "row");
      r.appendChild(el("span", "k", line.slice(0, idx)));
      var v = el("span", "v", line.slice(idx + 1).trim());
      if (line.indexOf("SIMULATED") >= 0) v.style.color = "var(--saffron)";
      r.appendChild(v);
      rows.appendChild(r);
    });
    rdCard.appendChild(rows);
  });

  var toggles = el("div", "toggles");
  toggles.appendChild(toggle("Relay running", n.relayOn, function (v) {
    n.relayOn = v;
    if (v) n.relay.start(); else n.relay.stop();
    renderAll();
  }));
  toggles.appendChild(toggle("Tier 2 microphone", !!n.listening, function (v) {
    n.listening = v;
    if (!v) { n.tier2Resolver = false; }
    renderAll();
  }));
  body.appendChild(toggles);

  var bat = el("div", "block");
  bat.appendChild(el("h3", null, "Battery band"));
  var seg = el("div", "seg");
  ["CRITICAL", "LOW", "MEDIUM", "HIGH"].forEach(function (label, i) {
    var b = el("button", null, label);
    b.setAttribute("aria-pressed", String(n.batteryBand === i));
    b.onclick = function () { n.batteryBand = i; n.engine.setBatteryBand(i); renderAll(); };
    seg.appendChild(b);
  });
  bat.appendChild(seg);
  bat.appendChild(el("p", "note", "At CRITICAL the policy engine stops relaying anything below response-control priority, and the routing score refuses outright."));
  body.appendChild(bat);

  // actions
  var act = el("div", "block");
  act.appendChild(el("h3", null, "Do something"));
  var list = el("div", "actions");
  Object.keys(ACTIONS).forEach(function (key) {
    var a = ACTIONS[key];
    if (a.kinds.indexOf(n.kind) < 0) return;
    var incidents = incidentChoices(n, a);
    var b = el("button", "act" + (a.accent ? " " + a.accent : ""));
    b.appendChild(el("b", null, a.label));
    b.appendChild(el("small", null, a.hint));
    if ((a.needsIncident || a.needsOwnIncident) && incidents.length === 0) {
      b.disabled = true;
      b.title = a.needsOwnIncident ? "no incident reported from this device yet" : "no incident known to this device yet";
    } else {
      b.onclick = function () {
        var target = incidents.length ? incidents[0] : undefined;
        runAction(n, key, target).then(renderAll);
      };
    }
    list.appendChild(b);
  });
  act.appendChild(list);
  body.appendChild(act);

  var recent = el("div", "block");
  recent.appendChild(el("h3", null, "Last packets this device handled"));
  var c = el("div", "card"), rs = el("div", "rows");
  var items = n.ingests.slice(-8).reverse();
  if (!items.length) rs.appendChild(el("div", "row empty-row", "nothing yet"));
  items.forEach(function (s) {
    var r = el("button", "row link-row");
    var name = s.validation.ok ? TYPE_NAME[s.validation.packet.header.type] : "rejected";
    r.appendChild(el("span", "k", name));
    var v = el("span", "v", s.accepted ? (s.storeOutcome || "accepted") : (s.validation.reason || "refused"));
    v.style.color = s.accepted ? "var(--green)" : "var(--bad)";
    r.appendChild(v);
    r.onclick = function () { UI.selectPacket(s.bytes, n); UI.lastIngest = s; UI.tab = "packet"; renderInspector(); };
    rs.appendChild(r);
  });
  c.appendChild(rs); recent.appendChild(c);
  body.appendChild(recent);
}

function incidentChoices(node, action) {
  var views = node.engine.incidents.list();
  if (action.needsOwnIncident) {
    return views.filter(function (v) { return v.ownedLocally; }).map(function (v) { return v.incidentId; });
  }
  if (action.needsIncident) {
    return views.filter(function (v) { return v.state !== "resolved" && v.state !== "cancelled"; })
      .map(function (v) { return v.incidentId; });
  }
  return [];
}

function toggle(label, value, onChange) {
  var l = el("label", "toggle");
  var i = document.createElement("input");
  i.type = "checkbox"; i.checked = value;
  i.onchange = function () { onChange(i.checked); };
  l.appendChild(i);
  l.appendChild(el("span", null, label));
  return l;
}

/* ---- packet / byte inspector ---------------------------------------------- */

UI.selectPacket = function (bytes, owner) {
  UI.packet = { bytes: bytes, ownerId: owner ? owner.id : null };
  UI.sel = null;
  UI.view = "envelope";
};

var HEADER_NOTES = {
  MAGIC: ["Magic 0x444d", 'The two ASCII bytes "DM". Gate 1 refuses anything else before another byte is read.'],
  VERSION: ["Protocol version", "Gate 2. A different version is rejected, never guessed at."],
  TYPE: ["Message type", "A code from the frozen registry — and it is hashed with the payload, so relabelling breaks the digest."],
  FLAGS: ["Flags", "FRAGMENTED, LOCATION_PRESENT, RECEIPT_REQUESTED, MAP_DELTA, TERMINAL, PROTOTYPE_AUTHORITY, TIER2_ORIGIN, COMMUNITY_REPORTED."],
  PRIORITY_SEVERITY: ["Priority : Severity", "Two independent meanings in one byte. Priority is the network queue class; severity is the human emergency level. Severity never grants authority."],
  HEADER_LENGTH: ["Header length", "64 here. Present so a typed header extension can grow without ambiguity."],
  PACKET_ID: ["Packet ID (16 B)", "Created once at the source and identical on every hop and both transports. This is what makes deduplication and the radio bridge work."],
  SOURCE_ID: ["Ephemeral source ID (8 B)", "Rotating and incident-scoped. Never an account, never a phone number."],
  CREATED: ["Created at", "Seconds since the demo epoch. Gate 7 refuses a packet created implausibly far ahead."],
  EXPIRES: ["Expires at", "Absolute expiry. Gate 7 drops anything already past it, so nothing lives in the mesh forever."],
  HOP_LIMIT: ["Hop limit", "Taken from the copy budget for this packet's class."],
  HOP_COUNT: ["Hop count", "The only byte a relay may change. Each forwarding node increments it and repairs the CRC."],
  PAYLOAD_LENGTH: ["Payload length", "Checked against the per-type maximum before any buffer is allocated."],
  FRAGMENT_INDEX: ["Fragment index", "Gate 9 refuses an index at or beyond the count."],
  FRAGMENT_COUNT: ["Fragment count", "1 for anything that fits in one record."],
  DIGEST_PREFIX: ["Payload digest prefix (8 B)", "First 8 bytes of SHA-256 over (type || payload). Same packet ID with a different digest is quarantined as a conflict."],
  SOURCE_CLASS: ["Source class", "The role label gate 12 checks. Provisioning, not cryptographic proof."],
  RESERVED: ["Reserved", "Zero. Kept for the next header extension."],
  CRC: ["Header CRC-32", "Covers bytes 0..59. Gate 4 discards a corrupted header before the expensive fields are parsed."]
};
var OFFSETS = CODEC.HEADER_OFFSETS;
var HEADER_LAYOUT = (function () {
  var entries = Object.keys(OFFSETS).map(function (k) { return [k, OFFSETS[k]]; }).sort(function (a, b) { return a[1] - b[1]; });
  return entries.map(function (e, i) {
    var end = i + 1 < entries.length ? entries[i + 1][1] : ENVELOPE.HEADER_BYTES;
    return { key: e[0], off: e[1], size: end - e[1], label: HEADER_NOTES[e[0]][0], note: HEADER_NOTES[e[0]][1] };
  });
})();
var GROUP = {
  MAGIC: "slate", VERSION: "slate", HEADER_LENGTH: "slate", RESERVED: "slate", DIGEST_PREFIX: "slate", CRC: "slate",
  TYPE: "saffron", FLAGS: "saffron", PRIORITY_SEVERITY: "saffron",
  PACKET_ID: "navy", SOURCE_ID: "navy", SOURCE_CLASS: "navy",
  CREATED: "green", EXPIRES: "green",
  HOP_LIMIT: "plum", HOP_COUNT: "plum", PAYLOAD_LENGTH: "plum", FRAGMENT_INDEX: "plum", FRAGMENT_COUNT: "plum"
};

/** Walks the real deterministic value encoding to label each payload byte. */
function annotatePayload(bytes, messageType) {
  var spans = [], pos = 0;
  var TAG = ["uint", "nint", "bytes", "text", "false", "true", "array", "map"];
  var RESERVED = { 250: "__streamId", 251: "__sourceSequence", 252: "__geo" };
  function uvarint() {
    var start = pos, result = 0, shift = 1;
    for (;;) { var b = bytes[pos++]; result += (b & 0x7f) * shift; if ((b & 0x80) === 0) break; shift *= 128; }
    return { value: result, start: start, end: pos };
  }
  function value(name, nested) {
    var t0 = pos, tag = bytes[pos++];
    if (tag === 0 || tag === 1) {
      var v = uvarint(); var num = tag === 0 ? v.value : -1 - v.value;
      spans.push({ start: t0, end: pos, kind: "value", name: name, note: TAG[tag] + " = " + num });
      return num;
    }
    if (tag === 2 || tag === 3) {
      var len = uvarint(), s = pos; pos += len.value;
      var raw = bytes.slice(s, pos);
      var out = tag === 3 ? new TextDecoder().decode(raw) : hex(raw);
      spans.push({ start: t0, end: pos, kind: "value", name: name, note: TAG[tag] + "(" + len.value + ") = " + (tag === 3 ? JSON.stringify(out) : out) });
      return out;
    }
    if (tag === 4 || tag === 5) { spans.push({ start: t0, end: pos, kind: "value", name: name, note: String(tag === 5) }); return tag === 5; }
    if (tag === 6) {
      var count = uvarint();
      spans.push({ start: t0, end: pos, kind: "struct", name: name, note: "array of " + count.value });
      var arr = []; for (var i = 0; i < count.value; i++) arr.push(value(name + "[" + i + "]", nested));
      return arr;
    }
    if (tag === 7) { spans.push({ start: t0, end: pos, kind: "struct", name: name, note: "nested map" }); return body(nested, name); }
    throw new Error("tag " + tag);
  }
  function body(map, prefix) {
    var count = uvarint();
    spans.push({ start: count.start, end: count.end, kind: "count", name: (prefix ? prefix + " " : "") + "field count", note: count.value + " fields follow" });
    var reverse = map ? CODEC.reverseFieldMap(map) : undefined;
    var out = {};
    for (var i = 0; i < count.value; i++) {
      var key = uvarint();
      var name = (reverse && reverse.get(key.value)) || RESERVED[key.value] || ("key " + key.value);
      spans.push({ start: key.start, end: key.end, kind: "key", name: "key " + key.value, note: 'wire key ' + key.value + ' → "' + name + '"' });
      out[name] = value(name, CODEC.NESTED_FIELD_MAPS[name]);
    }
    return out;
  }
  var base = CODEC.FIELD_MAP_BY_TYPE[messageType] || {};
  var map = Object.assign({}, base, { __streamId: 250, __sourceSequence: 251, __geo: 252 });
  var decoded;
  try { decoded = body(map, ""); } catch (e) { return { spans: spans, decoded: {}, error: String(e.message || e) }; }
  return { spans: spans, decoded: decoded };
}

function renderPacketTab(body) {
  if (!UI.packet) {
    body.appendChild(el("p", "empty", "No packet selected. Trigger an action on a device, or click a row under “Last packets this device handled”."));
    return;
  }
  var bytes = UI.packet.bytes;
  var decoded = CODEC.decodePacket(bytes);
  var header = decoded.ok ? decoded.packet.header : null;

  var top = el("div", "block");
  var seg = el("div", "seg");
  [["envelope", "Envelope 64 B"], ["payload", "Payload " + (bytes.length - ENVELOPE.HEADER_BYTES) + " B"]].forEach(function (o) {
    var b = el("button", null, o[1]);
    b.setAttribute("aria-pressed", String(UI.view === o[0]));
    b.onclick = function () { UI.view = o[0]; UI.sel = null; renderInspector(); };
    seg.appendChild(b);
  });
  top.appendChild(seg);
  body.appendChild(top);

  if (header) {
    body.appendChild(rowsCard([
      ["type", TYPE_NAME[header.type] + "  0x" + header.type.toString(16)],
      ["priority", PRIORITY_NAME[header.priority]],
      ["severity", SEVERITY_NAME[header.severity]],
      ["stream", decoded.packet.streamId || "—"],
      ["sequence", decoded.packet.sourceSequence !== undefined ? String(decoded.packet.sourceSequence) : "—"],
      ["size", bytes.length + " B = 64 header + " + (bytes.length - 64) + " payload"],
      ["budget class", CODEC.budgetClassFor(header.type, header.severity)],
      ["source label", VALIDATOR.SOURCE_LABEL_COPY[VALIDATOR.sourceLabelFor(header.sourceClass, header.flags)]]
    ]));
  }

  var view = UI.view === "payload"
    ? { hex: hex(bytes.subarray(ENVELOPE.HEADER_BYTES)), kind: "payload",
        ann: annotatePayload(bytes.subarray(ENVELOPE.HEADER_BYTES), header ? header.type : 0) }
    : { hex: hex(bytes.subarray(0, Math.min(ENVELOPE.HEADER_BYTES, bytes.length))), kind: "envelope" };

  var legend = el("div", "legend");
  (view.kind === "payload"
    ? [["count", "field count"], ["key", "wire key"], ["value", "typed value"], ["struct", "nested"]]
    : [["slate", "framing & integrity"], ["saffron", "what it means"], ["navy", "who & which packet"], ["green", "when it is valid"], ["plum", "how far it may travel"]]
  ).forEach(function (L) {
    var s = el("span"); var i = el("i"); i.className = "g-" + L[0]; s.appendChild(i); s.appendChild(el("span", null, L[1])); legend.appendChild(s);
  });
  body.appendChild(legend);

  var wrap = el("div", "grid-wrap"), grid = el("div");
  var arr = [];
  for (var i = 0; i < view.hex.length; i += 2) arr.push(parseInt(view.hex.substr(i, 2), 16));
  for (var r = 0; r * 16 < arr.length; r++) {
    var row = el("div", "brow");
    row.appendChild(el("span", "boff", String(r * 16).padStart(3, "0")));
    var cells = el("div", "bcells");
    for (var c = 0; c < 16 && r * 16 + c < arr.length; c++) {
      var off = r * 16 + c;
      var f = fieldAt(off, view);
      var cell = el("button", "byte g-" + f.group, arr[off].toString(16).padStart(2, "0"));
      cell.type = "button";
      if (UI.sel !== null && off >= f.start && off < f.start + f.size) cell.classList.add("sel");
      cell.title = f.label;
      (function (o) { cell.onclick = function () { UI.sel = o; renderInspector(); }; })(off);
      cells.appendChild(cell);
    }
    row.appendChild(cells);
    grid.appendChild(row);
  }
  wrap.appendChild(grid);
  body.appendChild(wrap);

  var box = el("div", "inspect");
  if (UI.sel === null) {
    box.appendChild(el("b", null, "Click any byte"));
    box.appendChild(el("p", null, "These are the actual bytes this device built or received — not a diagram of them."));
  } else {
    var f = fieldAt(UI.sel, view);
    var slice = arr.slice(f.start, f.start + f.size);
    var hs = slice.map(function (b) { return b.toString(16).padStart(2, "0"); }).join(" ");
    var num = null;
    if (f.size <= 4) { num = 0; for (var q = 0; q < slice.length; q++) num = num * 256 + slice[q]; }
    box.appendChild(el("b", null, f.label));
    box.appendChild(el("div", "meta", "offset " + f.start + (f.size > 1 ? "–" + (f.start + f.size - 1) : "") + " · " + f.size + " B · " + hs + (num !== null ? " · = " + num : "")));
    box.appendChild(el("p", null, f.note || "—"));
    var hint = decodeHint(f, num, view);
    if (hint) { var p = el("p", "hint", hint); box.appendChild(p); }
  }
  body.appendChild(box);

  // Custody for this packet on this device — copies made against the budget.
  if (header && UI.packet.ownerId) {
    var owner = world.node(UI.packet.ownerId);
    if (owner && owner.isMesh()) {
      var cb = el("div", "block");
      cb.appendChild(el("h3", null, "Custody on " + shortName(owner)));
      var slot = el("div", "card");
      slot.appendChild(el("div", "row empty-row", "reading\u2026"));
      cb.appendChild(slot);
      cb.appendChild(el("p", "note", "A relay spends one copy per peer it hands the packet to, then waits out a cooldown. Peers that already advertised it in their inventory are never offered it at all — which is why a crowded room does not multiply traffic."));
      body.appendChild(cb);
      owner.engine.packets.getCustody(header.packetId).then(function (c) {
        slot.innerHTML = "";
        if (!c) { slot.appendChild(el("div", "row empty-row", "not held by this device")); return; }
        var budget = CLASS_BUDGETS[CODEC.budgetClassFor(header.type, header.severity)];
        var rows = el("div", "rows");
        [["state", c.state],
         ["copies made", c.copiesMade + " of " + budget.copyBudget],
         ["budget left", String(c.copyBudgetRemaining)],
         ["peers known to hold it", String(c.knownHolders.length)],
         ["upload state", c.uploadState],
         ["link receipts", String(c.linkReceiptCount)]].forEach(function (p) {
          var r = el("div", "row");
          r.appendChild(el("span", "k", p[0]));
          r.appendChild(el("span", "v", p[1]));
          rows.appendChild(r);
        });
        slot.appendChild(rows);
      });
    }
  }

  if (view.kind === "payload" && view.ann) {
    var d = el("div", "block");
    d.appendChild(el("h3", null, "Decoded payload"));
    var pairs = Object.keys(view.ann.decoded).map(function (k) {
      var v = view.ann.decoded[k];
      return [k.replace(/^__/, ""), typeof v === "object" ? JSON.stringify(v) : String(v)];
    });
    d.appendChild(rowsCard(pairs));
    d.appendChild(el("p", "note", "No field names on the wire: every name is a one-byte key, every enum a number, every coordinate an integer times 1e7 — written in ascending key order so the bytes are deterministic."));
    body.appendChild(d);
  }
}

function fieldAt(off, view) {
  if (view.kind === "envelope") {
    for (var i = 0; i < HEADER_LAYOUT.length; i++) {
      var f = HEADER_LAYOUT[i];
      if (off >= f.off && off < f.off + f.size) return { group: GROUP[f.key], label: f.label, note: f.note, start: f.off, size: f.size };
    }
  } else if (view.ann) {
    for (var j = 0; j < view.ann.spans.length; j++) {
      var s = view.ann.spans[j];
      if (off >= s.start && off < s.end) return { group: s.kind, label: s.name, note: s.note, start: s.start, size: s.end - s.start };
    }
  }
  return { group: "none", label: "unmapped", note: "", start: off, size: 1 };
}

function decodeHint(f, num, view) {
  if (view.kind !== "envelope" || num === null) return null;
  if (f.label.indexOf("Message type") === 0) return "0x" + num.toString(16) + " = " + TYPE_NAME[num];
  if (f.label.indexOf("Priority") === 0) return "priority " + (num >> 4) + " = " + PRIORITY_NAME[num >> 4] + "   ·   severity " + (num & 15) + " = " + SEVERITY_NAME[num & 15];
  if (f.label.indexOf("Flags") === 0) {
    var names = [];
    Object.keys(Flags).forEach(function (k) { if (num & Flags[k]) names.push(k); });
    return names.length ? "set: " + names.join(", ") : "no flags set";
  }
  if (f.label.indexOf("Source class") === 0) return num + " = " + SOURCECLASS_NAME[num];
  if (f.label.indexOf("Created") === 0 || f.label.indexOf("Expires") === 0) {
    return new Date(TIME.DEMO_EPOCH_MS + num * 1000).toISOString().replace("T", " ").slice(0, 19) + " UTC";
  }
  return null;
}

/* ---- gates tab ------------------------------------------------------------- */

var GATE_ORDER = [
  "gate.envelope-length", "gate.protocol-version", "gate.declared-sizes", "gate.header-integrity",
  "gate.known-type", "gate.duplicate-lookup", "gate.clock-sanity", "gate.hop-limit",
  "gate.fragment-limits", "gate.payload-integrity", "gate.schema", "gate.source-role",
  "gate.geographic-relevance", "gate.user-preference", "gate.resource-pressure"
];

function renderGatesTab(body, n) {
  var s = UI.lastIngest && n.ingests.indexOf(UI.lastIngest) >= 0 ? UI.lastIngest : n.ingests[n.ingests.length - 1];
  if (!s) {
    body.appendChild(el("p", "empty", "This device has not handled a packet yet. Send an SOS from a neighbour, or trigger an action here."));
    return;
  }
  var v = s.validation;
  var verdict = el("div", "verdict " + (v.ok ? "ok" : "no"));
  if (v.ok) {
    verdict.appendChild(el("b", null, "Accepted · " + v.gatesPassed.length + " gates passed, " + v.gatesDeferred.length + " deferred to policy"));
    verdict.appendChild(el("p", null, VALIDATOR.SOURCE_LABEL_COPY[v.sourceLabel] + " · arrived over " + s.transport));
  } else {
    verdict.appendChild(el("b", null, "Rejected"));
    verdict.appendChild(el("p", null, v.reason + " at " + v.gate + (v.detail ? " · " + v.detail : "")));
  }
  body.appendChild(verdict);

  var card = el("div", "card"), g = el("div", "gates");
  GATE_ORDER.forEach(function (name, i) {
    var row = el("div", "gate");
    if (!v.ok && v.gate === name) row.classList.add("stop");
    else if (v.gatesPassed.indexOf(name) >= 0) row.classList.add("pass");
    else if (v.ok && v.gatesDeferred.indexOf(name) >= 0) row.classList.add("defer");
    row.appendChild(el("span", "num", i + 1));
    row.appendChild(el("span", "dot"));
    row.appendChild(el("span", null, name.replace("gate.", "")));
    if (row.classList.contains("stop")) row.appendChild(el("span", "tag", "stopped here"));
    else if (row.classList.contains("defer")) row.appendChild(el("span", "tag", "deferred"));
    g.appendChild(row);
  });
  card.appendChild(g);
  body.appendChild(card);

  if (!v.ok || !s.policy) {
    body.appendChild(el("p", "note", "One pipeline for every transport. Bluetooth, ggwave and the internet download all enter through it, and a refusal stores nothing, shows nothing and relays nothing."));
    return;
  }

  var pb = el("div", "block");
  pb.appendChild(el("h3", null, "Six independent decisions"));
  var pol = el("div", "pol");
  ["store", "display", "alert", "relay", "upload", "act"].forEach(function (k) {
    var b = el("button");
    b.appendChild(el("span", "lbl", k));
    b.appendChild(el("span", "val", s.policy[k]));
    b.setAttribute("aria-pressed", String(UI.policyKey === k));
    b.onclick = function () { UI.policyKey = UI.policyKey === k ? null : k; renderInspector(); };
    pol.appendChild(b);
  });
  pb.appendChild(pol);
  var why = el("p", "note");
  why.textContent = UI.policyKey
    ? UI.policyKey + " → " + s.policy.reasons[UI.policyKey]
    : "Receiving a packet does not mean showing it, alerting on it, forwarding it or uploading it. Tap one for its reason code.";
  pb.appendChild(why);
  body.appendChild(pb);

  // live forwarding score against a real neighbour
  var neighbour = Array.from(world.links).filter(function (k) { return k.indexOf(n.id) >= 0; })[0];
  if (neighbour && s.packetId) {
    renderUtility(body, n, neighbour.split("|").filter(function (id) { return id !== n.id; })[0], s.packetId);
  }
}

function renderUtility(body, node, peerId, packetId) {
  var peerNode = world.node(peerId);
  if (!peerNode) return;
  var box = el("div", "block");
  box.appendChild(el("h3", null, "Forward it to " + shortName(peerNode) + "?"));
  var slot = el("div", "card");
  slot.appendChild(el("div", "row empty-row", "scoring…"));
  box.appendChild(slot);
  body.appendChild(box);

  Promise.all([node.engine.packets.get(packetId), node.engine.packets.getCustody(packetId), node.engine.peers.get(peerNode.nodeToken)])
    .then(function (r) {
      var stored = r[0], custody = r[1], peer = r[2];
      slot.innerHTML = "";
      if (!stored || !custody) { slot.appendChild(el("div", "row empty-row", "not held by this device")); return; }
      var decision = ROUTING.forwardingUtility(
        { packetId: packetId, packet: stored.packet, custody: custody },
        {
          peer: peer || { peerToken: peerNode.nodeToken, lastSeenAtMs: world.medium.clockMs, gatewayProven: false, queueEpoch: 0, sessionsCompleted: 0, sessionsFailed: 0 },
          peerInventory: new Set(),
          nowMs: world.medium.clockMs,
          localBatteryBand: node.batteryBand,
          previousHopByPacket: new Map()
        }
      );
      if (!decision.forward) {
        var no = el("div", "row");
        no.appendChild(el("span", "k", "no"));
        var vv = el("span", "v", decision.reason); vv.style.color = "var(--ink-3)";
        no.appendChild(vv);
        slot.appendChild(no);
        return;
      }
      var pad = el("div", "pad");
      var bar = el("div", "ubar");
      var COLOURS = { gateway: "#10365c", novelty: "#0d6b41", urgency: "#b4590f", reliability: "#5c2f6b", age: "#5b6b78", battery: "#9aa6ae" };
      var ul = el("div", "ulist");
      Object.keys(decision.components).forEach(function (k) {
        var d = el("div");
        d.style.width = (decision.components[k] * 100) + "%";
        d.style.background = COLOURS[k];
        d.title = k;
        bar.appendChild(d);
        var s = el("span"); var i = el("i"); i.style.background = COLOURS[k];
        s.appendChild(i); s.appendChild(el("span", null, k + " " + decision.components[k].toFixed(2)));
        ul.appendChild(s);
      });
      pad.appendChild(el("div", "u-head", "utility " + decision.utility.toFixed(3) + " · " + decision.reason));
      pad.appendChild(bar);
      pad.appendChild(ul);
      slot.appendChild(pad);
    });
}

/* ---- incidents tab --------------------------------------------------------- */

function renderIncidentsTab(body, n) {
  var views = n.engine.incidents.list();
  if (!views.length) {
    body.appendChild(el("p", "empty", "No incidents known to this device."));
    return;
  }
  views.forEach(function (v) {
    var blk = el("div", "block");
    var h = el("h3");
    h.appendChild(el("span", null, v.incidentId));
    var st = el("span", "state-chip " + v.state, v.state);
    h.appendChild(st);
    blk.appendChild(h);
    blk.appendChild(rowsCard([
      ["severity", SEVERITY_NAME[v.severity]],
      ["people", v.peopleTotal !== undefined ? String(v.peopleTotal) : "—"],
      ["injured", v.injured !== undefined ? String(v.injured) : "—"],
      ["owned here", v.ownedLocally ? "yes" : "no"],
      ["responder", v.responderRef || "—"]
    ]));
    var d = v.delivery || {};
    /* SOS-008 / DEC-022: the approved wording, straight from DELIVERY_STATE_COPY. */
    var facts = el("div", "block");
    facts.appendChild(el("h3", null, "Delivery timeline"));
    var reached = [
      ["saved-locally", d.savedLocallyAtS !== undefined],
      ["copied-to-peer", (d.distinctPeerReceipts || 0) > 0],
      ["seen-by-responder", d.responderSeenAtS !== undefined],
      ["uploaded-via-gateway", d.uploadedAtS !== undefined],
      ["accepted-by-backend", d.backendAcceptedAtS !== undefined],
      ["responder-assigned", d.assignedAtS !== undefined],
      ["responder-accepted", d.acceptedAtS !== undefined],
      ["responder-en-route", d.enRouteAtS !== undefined],
      ["responder-arrived", d.arrivedAtS !== undefined],
      ["resolved", d.resolvedAtS !== undefined],
      ["cancelled", d.cancelledAtS !== undefined]
    ];
    facts.appendChild(rowsCard(reached.map(function (p) {
      var extra = p[0] === "copied-to-peer" && p[1] ? "  (" + d.distinctPeerReceipts + " distinct)" : "";
      return [DELIVERY_STATE_COPY[p[0]] + extra, p[1] ? "reached" : "not yet", p[1] ? "green" : "ink-3"];
    })));
    blk.appendChild(facts);
    blk.appendChild(el("p", "note", "This wording is DELIVERY_STATE_COPY from @dsm/contracts, which the app is required to use verbatim. A copy on a neighbouring phone is not a responder acknowledgement, and neither is proof the coordination centre received it."));
    body.appendChild(blk);
  });
}

/* ---- radio tab -------------------------------------------------------------- */

function renderRadioTab(body, tower) {
  var listeners = world.meshNodes().filter(function (n) {
    return n.listening && world.distance(n, tower) <= tower.audioRange;
  });

  body.appendChild(rowsCard([
    ["profile", TIER2.GGWAVE_PROFILES[tower.profile].label + " · " + TIER2.GGWAVE_PROFILES[tower.profile].bytesPerSecond + " B/s"],
    ["audio radius", Math.round(tower.audioRange * METRES_PER_UNIT) + " m"],
    ["phones listening", String(listeners.length)],
    ["state", tower.broadcast ? "broadcasting " + tower.broadcast.index + "/" + tower.broadcast.schedule.length : "idle"]
  ]));

  var seg = el("div", "seg");
  Object.keys(TIER2.GGWAVE_PROFILES).forEach(function (p) {
    var b = el("button", null, TIER2.GGWAVE_PROFILES[p].label);
    b.setAttribute("aria-pressed", String(tower.profile === p));
    b.onclick = function () { tower.profile = p; renderInspector(); };
    seg.appendChild(b);
  });
  body.appendChild(seg);
  body.appendChild(slider("Audio radius", tower.audioRange, 100, 460, 10, function (v) { tower.audioRange = v; }, function (v) { return Math.round(v * METRES_PER_UNIT) + " m"; }));

  var go = el("button", "btn primary wide", tower.broadcast ? "Stop broadcast" : "Plan and broadcast");
  go.onclick = function () {
    if (tower.broadcast) { tower.broadcast = null; renderAll(); return; }
    buildCampaign(tower).then(function (r) {
      if (r.error) { tower.error = r.error; renderAll(); return; }
      tower.error = null;
      tower.broadcast = { schedule: r.schedule, index: 0 };
      // A new campaign means every listener needs a fresh resolver.
      world.meshNodes().forEach(function (n) { n.tier2Resolver = false; });
      renderAll();
    });
  };
  body.appendChild(go);
  if (tower.error) {
    var e = el("div", "verdict no");
    e.appendChild(el("b", null, "Cannot plan a campaign"));
    e.appendChild(el("p", null, tower.error));
    body.appendChild(e);
  }

  if (tower.campaign) {
    var m = tower.campaign.manifest;
    var blk = el("div", "block");
    blk.appendChild(el("h3", null, "Campaign plan"));
    blk.appendChild(rowsCard([
      ["campaign", m.campaignId],
      ["air time", m.totalDurationS + " s of " + tower.campaign.budgetS + " s budget", tower.campaign.overBudget ? "bad" : "green"],
      ["bytes on air", m.totalTier2Bytes + " B"],
      ["records", String(m.items.length)]
    ]));
    var it = el("div", "card"), rs = el("div", "rows");
    m.items.forEach(function (i) {
      var r = el("div", "row");
      r.appendChild(el("span", "k", TYPE_NAME[i.messageType]));
      r.appendChild(el("span", "v", "×" + i.repeats + " · " + i.tier1Bytes + " B → " + i.tier2Bytes + " B · " + (i.estimatedAudioMs / 1000).toFixed(1) + " s"));
      rs.appendChild(r);
    });
    it.appendChild(rs); blk.appendChild(it);
    blk.appendChild(el("p", "note", "The critical alert repeats most often, and repeats are interleaved so one noise burst cannot destroy every copy of a single item. Tier 2 drops the 64-byte envelope and resolves identity from the manifest instead."));
    body.appendChild(blk);
  }

  if (listeners.length) {
    var lb = el("div", "block");
    lb.appendChild(el("h3", null, "What the listeners have"));
    listeners.forEach(function (n) {
      var mt = n.tier2 ? n.tier2.metrics() : null;
      if (!mt) return;
      var c = el("div", "card");
      c.appendChild(el("div", "sub-head", shortName(n) + " · " + mt.state));
      var meters = el("div", "meters");
      [["framesDetected", "detected"], ["framesValid", "valid"], ["framesCorrupt", "corrupt"], ["framesDuplicate", "duplicate"]].forEach(function (k) {
        var d = el("div"); if (k[0] === "framesCorrupt" && mt[k[0]] > 0) d.className = "hot";
        d.appendChild(el("b", null, mt[k[0]]));
        d.appendChild(el("span", null, k[1]));
        meters.appendChild(d);
      });
      c.appendChild(meters);
      if (mt.packetsExpected) {
        c.appendChild(el("div", "sub-note", mt.packetsRecovered + " of " + mt.packetsExpected + " packets recovered" +
          (mt.missingPacketIds.length ? " · " + mt.missingPacketIds.length + " still missing" : "")));
      }
      lb.appendChild(c);
    });
    body.appendChild(lb);
  } else {
    body.appendChild(el("p", "note", "No phone in range has its Tier 2 microphone on. Select a phone and turn it on — then everything it recovers re-enters the mesh over Bluetooth."));
  }
}

/* ---- centre tab -------------------------------------------------------------- */

function renderCentreTab(body, node) {
  var b = world.backend;
  body.appendChild(rowsCard([
    ["packets accepted", String(b.received.size)],
    ["acknowledgements queued", String(b.acks)],
    ["upload items seen", String(b.uploads)]
  ]));
  body.appendChild(el("p", "note", "The centre revalidates every upload with the same 15 gates the phones run — there is no privileged backend ingress. When it accepts a packet it builds a real BACKEND_ACKNOWLEDGEMENT, which travels back down through a gateway phone and then across Bluetooth. Only that acknowledgement reaching the reporter may claim the centre received it."));

  var blk = el("div", "block");
  blk.appendChild(el("h3", null, "Which phones can reach it"));
  var pairs = world.meshNodes().map(function (n) {
    var gw = n.gatewayState.current(world.medium.clockMs);
    return [shortName(n), gw.state, gw.state === "proven" ? "green" : "ink-3"];
  });
  blk.appendChild(rowsCard(pairs.length ? pairs : [["—", "no phones yet"]]));
  blk.appendChild(el("p", "note", "A gateway flag needs a recent successful live probe. Drag a phone out of Region B and the next probe fails — the flag drops within " + FRESHNESS.GATEWAY_PROOF_S + " s."));
  body.appendChild(blk);
}

/* ---- log --------------------------------------------------------------------- */

var LOG_CATEGORIES = ["all", "validation", "policy", "session", "transfer", "peer-discovery", "gateway", "tier2", "incident", "inventory"];

function renderLog() {
  var head = $("#log-filters");
  if (!head.childElementCount) {
    LOG_CATEGORIES.forEach(function (cat) {
      var b = el("button", "lf", cat === "all" ? "everything" : cat);
      b.setAttribute("aria-pressed", String(UI.logFilter === cat));
      b.onclick = function () {
        UI.logFilter = cat;
        Array.prototype.forEach.call(head.children, function (c) { c.setAttribute("aria-pressed", String(c.textContent === (cat === "all" ? "everything" : cat))); });
        renderLog();
      };
      head.appendChild(b);
    });
  }
  var out = $("#log-body");
  var rows = world.logLines.filter(function (L) {
    if (UI.logFilter !== "all" && L.e.category !== UI.logFilter) return false;
    return true;
  }).slice(-120).reverse();
  out.innerHTML = "";
  rows.forEach(function (L) {
    var r = el("div", "lrow " + (L.e.severity === "error" ? "err" : L.e.severity === "warn" ? "warn" : ""));
    r.appendChild(el("span", "lt", ((L.e.atMs % 600000) / 1000).toFixed(1) + "s"));
    r.appendChild(el("span", "lc", L.e.category));
    var who = el("span", "lw", L.who);
    if (L.whoId) { who.classList.add("clickable"); who.onclick = function () { UI.selected = L.whoId; renderAll(); }; }
    r.appendChild(who);
    r.appendChild(el("span", "ln", L.e.name));
    var detail = [];
    if (L.e.reason) detail.push(L.e.reason);
    if (L.e.result) detail.push(L.e.result);
    if (L.e.transport) detail.push(L.e.transport);
    if (L.e.packetType !== undefined) detail.push(TYPE_NAME[L.e.packetType] || ("0x" + L.e.packetType.toString(16)));
    if (L.e.metrics) Object.keys(L.e.metrics).forEach(function (k) { detail.push(k + "=" + L.e.metrics[k]); });
    r.appendChild(el("span", "ld", detail.join("  ·  ")));
    out.appendChild(r);
  });
}

/* ---- stats strip -------------------------------------------------------------- */

function renderStats() {
  var s = $("#stats");
  var mesh = world.meshNodes();
  var proven = mesh.filter(function (n) { return n.engine.isGatewayProven(world.medium.clockMs); }).length;
  var listening = mesh.filter(function (n) { return n.listening; }).length;
  s.innerHTML = "";
  [["devices", world.nodes.size], ["live links", world.links.size], ["gateways proven", proven],
   ["listening", listening], ["centre holds", world.backend.received.size]].forEach(function (p) {
    var d = el("div", "stat");
    d.appendChild(el("b", null, p[1]));
    d.appendChild(el("span", null, p[0]));
    s.appendChild(d);
  });
}

/* ---- presets ------------------------------------------------------------------ */

var PRESETS = [
  /* ---- relay shapes ---------------------------------------------------- */
  {
    group: "Relay shapes", name: "Three-hop chain",
    blurb: "A chain, not a clique. The responder has no direct link.",
    watch: "The responder is only reachable through the middle phone. Open its Gates tab: the first copy is inserted and applies a map operation, the second is a duplicate and applies none.",
    build: function () {
      var a = world.add("public", 110, 190);
      world.add("public", 230, 300);
      world.add("responder", 350, 410);
      return a;
    },
    open: function (a) { return runAction(a, "sos"); }
  },
  {
    group: "Relay shapes", name: "Store and carry",
    blurb: "Two clusters too far apart, and one courier between them.",
    watch: "The SOS reaches the courier and stops there. Drag the courier right until it links the far cluster: custody travelled with the phone, not over any link.",
    build: function () {
      var a = world.add("public", 90, 150);
      world.add("public", 170, 240);
      world.add("public", 280, 330);
      world.add("responder", 760, 300);
      world.add("public", 840, 400);
      return a;
    },
    open: function (a) { return runAction(a, "sos"); }
  },
  {
    group: "Relay shapes", name: "Dense cluster",
    blurb: "Eight phones in one room. Nothing floods.",
    watch: "Every phone is in range of most others, yet the reporter makes barely any copies. Select the SOS in the Packet tab and read Custody: the inventory exchange means peers already hold it, so the copy budget is never spent. Nothing floods.",
    build: function () {
      var pts = [[240, 300], [325, 300], [283, 374], [197, 374], [155, 300], [197, 226], [283, 226], [240, 160]];
      var first = null;
      pts.forEach(function (p, i) {
        var n = world.add("public", p[0], p[1]);
        if (i === 0) first = n;
      });
      world.add("responder", 420, 430);
      return first;
    },
    open: function (a) { return runAction(a, "sos"); }
  },
  {
    group: "Relay shapes", name: "Ring",
    blurb: "Four phones in a loop, so there are two ways round.",
    watch: "Each phone links its neighbours but not the one opposite, so the packet arrives twice by two different routes. The second arrival is recorded as an observation and suppressed as an action.",
    build: function () {
      var a = world.add("public", 175, 225);
      world.add("public", 325, 225);
      world.add("responder", 325, 375);
      world.add("public", 175, 375);
      return a;
    },
    open: function (a) { return runAction(a, "sos"); }
  },

  /* ---- roles and policy ------------------------------------------------- */
  {
    group: "Roles and policy", name: "Two responders",
    blurb: "One incident that two responders can both see.",
    watch: "Both responders get show-full from policy.responder-role, while the public phone relaying between them only ever gets show-minimal. Accept the case on one and watch the lifecycle travel back to the reporter.",
    build: function () {
      var a = world.add("public", 140, 200);
      world.add("public", 270, 300);
      world.add("responder", 400, 400);
      world.add("responder", 330, 180);
      return a;
    },
    open: function (a) { return runAction(a, "sos"); }
  },
  {
    group: "Roles and policy", name: "Flat battery in the middle",
    blurb: "The relay phone is at CRITICAL. Only urgent traffic crosses.",
    watch: "The SOS still crosses - it is EMERGENCY priority. The shelter the responder publishes does not come back: at battery band 0 the routing score refuses anything below response-control with policy.battery-restricted.",
    build: function () {
      var a = world.add("public", 110, 190);
      var mid = world.add("public", 230, 300);
      mid.batteryBand = 0;
      mid.engine.setBatteryBand(0);
      world.add("responder", 350, 410);
      return a;
    },
    open: function (a) {
      return runAction(a, "sos").then(function () {
        var r = world.meshNodes().filter(function (n) { return n.kind === "responder"; })[0];
        return r ? runAction(r, "shelter") : null;
      });
    }
  },
  {
    group: "Roles and policy", name: "Who said so",
    blurb: "The same hazard, reported by a phone and by an authority.",
    watch: "Two HAZARD packets of the same shape carrying different trust. Open each in the Packet tab: one is Community reported, the other Authority (demo-provisioned). Neither says verified - that word is not in the vocabulary.",
    build: function () {
      var a = world.add("public", 150, 250);
      world.add("authority", 300, 200);
      world.add("responder", 240, 360);
      return a;
    },
    open: function (a) {
      return runAction(a, "hazard").then(function () {
        var auth = world.list().filter(function (n) { return n.kind === "authority"; })[0];
        return auth ? runAction(auth, "hazard") : null;
      });
    }
  },

  /* ---- the internet path ------------------------------------------------ */
  {
    group: "The internet path", name: "Two regions",
    blurb: "One region dark, one with an uplink, and a gap to walk.",
    watch: "Drag the middle phone into Region B. Its live probe succeeds, the upload goes out, the centre revalidates and answers. Drag it back and the reporter learns the centre received it - and the gateway flag drops, because the next probe fails.",
    build: function () {
      world.add("backend", REGIONS[1].x + REGIONS[1].w - 60, REGIONS[1].y + 46);
      var a = world.add("public", 110, 200);
      world.add("public", 250, 260);
      world.add("responder", 600, 300);
      world.add("public", 740, 360);
      return a;
    },
    open: function (a) { return runAction(a, "sos"); }
  },
  {
    group: "The internet path", name: "Centre unreachable",
    blurb: "A coordination centre exists. Nobody can reach it.",
    watch: "Every probe fails with no route from this region, so no phone ever claims a gateway. The SOS still relays perfectly across the mesh - and nothing anywhere pretends the centre has seen it.",
    build: function () {
      world.add("backend", REGIONS[1].x + REGIONS[1].w - 60, REGIONS[1].y + 46);
      var a = world.add("public", 120, 220);
      world.add("public", 250, 320);
      world.add("responder", 370, 430);
      return a;
    },
    open: function (a) { return runAction(a, "sos"); }
  },
  {
    group: "The internet path", name: "Bridge at the boundary",
    blurb: "A chain long enough to span both regions unaided.",
    watch: "Nobody has to walk. The chain reaches out of the dark region into the covered one, so an SOS from the far corner uploads through a phone several hops away that it will never meet.",
    build: function () {
      world.add("backend", REGIONS[1].x + REGIONS[1].w - 60, REGIONS[1].y + 46);
      var a = world.add("public", 300, 300);
      world.add("public", 420, 380);
      world.add("public", 545, 300);
      world.add("responder", 700, 300);
      return a;
    },
    open: function (a) { return runAction(a, "sos"); }
  },

  /* ---- the radio path ---------------------------------------------------- */
  {
    group: "The radio path", name: "Radio into the mesh",
    blurb: "One phone listens. Everybody ends up with the alert.",
    watch: "Only the responder has its microphone on, and the far phone is well outside the audio circle. Tier 2 recovers the canonical packet and Bluetooth carries it the rest of the way.",
    build: function () {
      var tower = world.add("radio", 500, 90);
      tower.audioRange = 260; tower.profile = "audible-fast";
      var auth = world.add("authority", 760, 150);
      var r = world.add("responder", 470, 250);
      r.listening = true;
      world.add("public", 360, 370);
      world.add("public", 250, 470);
      return auth;
    },
    open: function (auth) {
      return runAction(auth, "alert")
        .then(function () { return runAction(auth, "routeClosed"); })
        .then(function () { return runAction(auth, "shelter"); })
        .then(function () { return startBroadcast(radioTower()); });
    }
  },
  {
    group: "The radio path", name: "Noisy broadcast",
    blurb: "Heavy loss on the air. Repetition is the whole answer.",
    watch: "Frames fail their CRC-16 and are treated as absent, never partly applied. Watch framesCorrupt climb on the station tab while the interleaved repeats still finish the campaign. The deaf phone below is outside the audio circle and gets everything over Bluetooth anyway.",
    loss: 0.22,
    build: function () {
      var tower = world.add("radio", 420, 100);
      tower.audioRange = 300; tower.profile = "audible-fast";
      var auth = world.add("authority", 800, 160);
      var r = world.add("responder", 420, 290);
      r.listening = true;
      world.add("public", 330, 420);   // deaf, and outside the audio circle
      return auth;
    },
    open: function (auth) {
      return runAction(auth, "alert")
        .then(function () { return runAction(auth, "routeClosed"); })
        .then(function () { return startBroadcast(radioTower()); });
    }
  },
  {
    group: "The radio path", name: "Radio over the dark region",
    blurb: "Audio covers the blackout only. The mesh does the rest.",
    watch: "The station cannot reach Region B at all. One listening phone in the dark region recovers the alert and hands it to a chain that carries it across the boundary - Tier 2 in, Tier 1 onward.",
    build: function () {
      var tower = world.add("radio", 240, 90);
      tower.audioRange = 200; tower.profile = "audible-normal";
      var r = world.add("responder", 240, 250);
      r.listening = true;
      world.add("public", 380, 350);
      world.add("public", 520, 430);
      world.add("public", 660, 480);
      var auth = world.add("authority", 860, 150);
      return auth;
    },
    open: function (auth) {
      return runAction(auth, "alert").then(function () { return startBroadcast(radioTower()); });
    }
  }
];

function radioTower() {
  return world.list().filter(function (n) { return n.kind === "radio"; })[0];
}

/** Plans a campaign from the authority records in the world and starts it. */
function startBroadcast(tower) {
  if (!tower) return Promise.resolve(null);
  return buildCampaign(tower).then(function (r) {
    if (r.error) { tower.error = r.error; return null; }
    tower.error = null;
    tower.broadcast = { schedule: r.schedule, index: 0 };
    // A new campaign means every listener needs a fresh resolver.
    world.meshNodes().forEach(function (n) { n.tier2Resolver = false; });
    return r;
  });
}

function loadPreset(preset) {
  world.list().forEach(function (n) { world.remove(n.id); });
  world.logLines.length = 0;
  world.lossRate = preset.loss || 0;
  world.scenario = preset;
  // Fresh centre per scenario: nodes below take their client from it, and a
  // carried-over dedup cache would refuse the new run's uploads as duplicates.
  world.backend = new MockBackend(world);
  world.incidentSeq = 0;
  world.alertSeq = 0;
  UI.packet = null; UI.sel = null; UI.lastIngest = null;
  var focus = preset.build();
  UI.selected = focus ? focus.id : null;
  renderAll();
  world.start().then(function () {
    renderAll();
    // Give the relays a moment to advertise before the opening move.
    if (preset.open && focus) setTimeout(function () { preset.open(focus).then(renderAll); }, 600);
  });
}

/* ---- shell -------------------------------------------------------------------- */

function renderScenarioBar() {
  var bar = $("#scenario-bar");
  bar.innerHTML = "";
  if (!world.scenario) {
    bar.appendChild(el("span", "sb-hint", "drag to move \u00b7 click to inspect \u00b7 Delete removes"));
    return;
  }
  bar.appendChild(el("b", null, world.scenario.name));
  bar.appendChild(el("span", "sb-watch", world.scenario.watch));
}

function renderAll() {
  renderPalette();
  renderScenarioBar();
  renderCanvas();
  renderInspector();
  renderStats();
  renderLog();
}

var busy = false;
function loop() {
  if (!busy) {
    busy = true;
    world.step().catch(function (e) { console.error(e); }).then(function () {
      busy = false;
      renderCanvas();
      renderStats();
      renderLog();
      if (UI.tab !== "packet") renderInspector();
    });
  }
  requestAnimationFrame(function () { renderCanvas(); });
}

function boot() {
  // Start the clock at a real wall time so created/expiry values are real seconds.
  world.medium.advance(Date.UTC(2026, 7, 22, 9, 14, 0)).then(function () {
    bindStage();
    loadPreset(PRESETS[0]);
    UI.loopTimer = setInterval(loop, 320);
    UI.paintTimer = setInterval(function () { if (!world.paused) renderCanvas(); }, 60);
  });

  $("#pause").onclick = function () {
    world.paused = !world.paused;
    $("#pause").textContent = world.paused ? "Resume" : "Pause";
    $("#pause").classList.toggle("paused", world.paused);
  };
  $("#clear").onclick = function () {
    world.list().forEach(function (n) { world.remove(n.id); });
    world.logLines.length = 0;
    world.backend = new MockBackend(world);
    world.scenario = null;
    UI.selected = null; UI.packet = null; UI.lastIngest = null;
    renderAll();
  };
  document.addEventListener("keydown", function (e) {
    if (e.target.tagName === "INPUT") return;
    if (e.key === " ") { $("#pause").click(); e.preventDefault(); }
    if (e.key === "Delete" && UI.selected) { world.remove(UI.selected); UI.selected = null; renderAll(); }
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();

/* Handy from the browser console: __sim.world.nodes, __sim.world.backend, etc. */
window.__sim = {
  world: world, UI: UI, ACTIONS: ACTIONS, runAction: runAction, render: renderAll,
  /** Stop the automatic loop so steps can be driven one at a time. */
  pauseLoop: function () { clearInterval(UI.loopTimer); UI.loopTimer = null; },
  resumeLoop: function () { if (!UI.loopTimer) UI.loopTimer = setInterval(loop, 320); },
  /** Run n simulated steps back to back, ignoring the pause button. */
  drive: function (n) {
    var p = Promise.resolve();
    for (var i = 0; i < n; i += 1) p = p.then(function () { return world.step(); });
    return p.then(renderAll);
  }
};

})();
