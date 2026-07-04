# Watermark Audio

Drop your watermark audio file here. The default path is `./assets/watermark.wav`
(can be overridden with `WATERMARK_AUDIO_PATH` in `.env`).

If the file is missing, the watermark service falls back to generating a periodic
sine tone so the system still produces an audible watermark.