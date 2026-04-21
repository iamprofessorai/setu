import { InferenceSession, Tensor } from 'onnxruntime-web';

class VAD {
  private session: InferenceSession | null = null;
  private h: Float32Array;
  private c: Float32Array;
  private sampleRate = 16000;

  constructor() {
    this.h = new Float32Array(2 * 1 * 64).fill(0);
    this.c = new Float32Array(2 * 1 * 64).fill(0);
  }

  async init() {
    // Using a reliable CDN for Silero VAD model
    const modelUrl = 'https://cdn.jsdelivr.net/gh/snakers4/silero-vad/files/silero_vad.onnx';
    this.session = await InferenceSession.create(modelUrl);
  }

  async process(audioFrame: Float32Array): Promise<number> {
    if (!this.session) return 0;

    // Silero VAD expects [1, 512] for 16kHz
    const tensor = new Tensor('float32', audioFrame, [1, audioFrame.length]);
    const srTensor = new Tensor('int64', BigInt64Array.from([BigInt(this.sampleRate)]), [1]);
    const hTensor = new Tensor('float32', this.h, [2, 1, 64]);
    const cTensor = new Tensor('float32', this.c, [2, 1, 64]);

    const result = await this.session.run({
      input: tensor,
      sr: srTensor,
      h: hTensor,
      c: cTensor,
    });

    this.h = result.hn.data as Float32Array;
    this.c = result.cn.data as Float32Array;

    return (result.output.data as Float32Array)[0];
  }

  reset() {
    this.h.fill(0);
    this.c.fill(0);
  }
}

export default VAD;
