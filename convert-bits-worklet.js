const VERSION = "1.0.2";
console.log(`convert-bits-worklet.js version ${VERSION}`);
// const SMOOTHING_FACTOR = 0.8;

class ConvertBitsProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [];
  }

  #lastUpdate;
  #volume;
  #bits;
  #audioBuffer;

  constructor() {
    super();
    this.#bits = 0;
    this.#lastUpdate = currentTime;
    this.#volume = 0;
    this.#audioBuffer = [];

    this.port.onmessage = (e) => {
      if (e.data.eventType === "ping") {
        this.port.postMessage({ eventType: "bits", bits: this.#bits });
        this.#bits = 0;
      }
    };
  }

  calculateVolumeMeter(inputs) {
    const inputChannelData = inputs[0][0]; // Float32Array(128)
    let sum = 0;

    // Calculate the squared-sum.
    for (let i = 0; i < inputChannelData.length; ++i) {
      sum += inputChannelData[i] * inputChannelData[i];
    }

    // Calculate the RMS level and update the volume.
    const rms = Math.sqrt(sum / inputChannelData.length);

    // this smoothing factor is used to reduce the sensitivity of the volume meter
    // if you want to use this, just command out the line below
    // this.#volume = Math.max(rms, this.#volume * SMOOTHING_FACTOR);

    this.#volume = rms;

    // Post a message to the node every 16ms.
    if (currentTime - this.#lastUpdate > 0.016) {
      this.port.postMessage({
        eventType: "volume",
        volume: this.#volume,
      });
      this.#lastUpdate = currentTime;
    }
  }

  calculateBits(data) {
    this.#bits += (data.BYTES_PER_ELEMENT * data.length * 8) / 1000;
  }

  convertFloat32ToInt16(inputs) {
    const inputChannelData = inputs[0][0];

    const data = Int16Array.from(inputChannelData, (n) => {
      const res = n < 0 ? n * 32768 : n * 32767; // convert in range [-32768, 32767]
      return Math.max(-32768, Math.min(32767, res)); // clamp
    });

    this.calculateBits(data);

    // ref: https://stackoverflow.com/questions/14071463/how-can-i-merge-typedarrays-in-javascript
    this.#audioBuffer = Int16Array.from([...this.#audioBuffer, ...data]);
    if (this.#audioBuffer.length >= 3200) {
      this.port.postMessage({
        eventType: "data",
        audioBuffer: this.#audioBuffer,
      });
      this.#audioBuffer = [];
    }
  }

  process(inputs) {
    if (inputs[0].length === 0) {
      console.error("From Convert Bits Worklet, input is null");
      return false;
    }

    this.calculateVolumeMeter(inputs);

    this.convertFloat32ToInt16(inputs);

    return true;
  }
}

registerProcessor("convert-bits-processor", ConvertBitsProcessor);
