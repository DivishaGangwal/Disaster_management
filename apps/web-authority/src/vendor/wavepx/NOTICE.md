# WavePX source notice

The browser acoustic adapter is derived from the low-level transport and audio
lifecycle in [WavePX](https://github.com/0xNtive/wavepx), commit
`81c7c30cc9c2f2a42bc04a43087b6fa9b43e237d`.

The high-level WavePX text frame is deliberately not used: Disaster SOS Mesh
already has a frozen binary Tier 2 frame. `WavePxTransport` carries those exact
bytes through ggwave, while `WavePxAudioManager` owns the Web Audio lifecycle.

The source was vendored because the documented npm package was unavailable and
the GitHub package did not include its built `dist/lib` output at verification
time. Upstream remains MIT licensed.
