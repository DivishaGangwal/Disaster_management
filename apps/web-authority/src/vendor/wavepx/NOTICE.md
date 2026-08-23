# WavePX source notice

The browser acoustic adapter vendors the WavePX application/audio library from
[WavePX](https://github.com/0xNtive/wavepx), commit
`81c7c30cc9c2f2a42bc04a43087b6fa9b43e237d`.

`SonicPixel.sendRaw()`, `generateWav()`, microphone capture, playback and the
WavePX audio manager carry Disaster SOS Mesh's frozen Tier 2 frames. A narrow
`onRawReceive`/`decodeSamples` extension completes the symmetric raw receive
path without disguising emergency packets as WavePX QR, image, text, game or
bidirectional file-transfer messages. ggwave remains WavePX's physical modem.

The source was vendored because the documented npm package was unavailable and
the GitHub package did not include its built `dist/lib` output at verification
time. Upstream remains MIT licensed.
