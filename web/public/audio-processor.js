// AudioWorklet processor for downsampling and PCM conversion
class AudioDownsamplerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 1600; // 100ms at 16kHz
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
    this.downsampleRatio = 3; // 48kHz -> 16kHz
    this.downsampleCounter = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];

    if (!input || !input[0]) {
      return true;
    }

    const inputChannel = input[0];

    for (let i = 0; i < inputChannel.length; i++) {
      // Downsample from 48kHz to 16kHz (take every 3rd sample)
      this.downsampleCounter++;
      if (this.downsampleCounter >= this.downsampleRatio) {
        this.downsampleCounter = 0;

        // Add sample to buffer
        this.buffer[this.bufferIndex] = inputChannel[i];
        this.bufferIndex++;

        // When buffer is full, send it to main thread
        if (this.bufferIndex >= this.bufferSize) {
          // Convert Float32 to Int16 PCM
          const pcmData = new Int16Array(this.bufferSize);
          for (let j = 0; j < this.bufferSize; j++) {
            // Clamp to [-1, 1] and convert to 16-bit signed integer
            const s = Math.max(-1, Math.min(1, this.buffer[j]));
            pcmData[j] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }

          // Send PCM data to main thread
          this.port.postMessage({
            type: 'audio',
            data: pcmData.buffer
          }, [pcmData.buffer]);

          // Reset buffer
          this.bufferIndex = 0;
        }
      }
    }

    return true;
  }
}

registerProcessor('audio-downsampler-processor', AudioDownsamplerProcessor);
