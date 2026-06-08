export interface VoiceRecorderOptions {
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  onError?: (message: string) => void;
}

export const useVoiceRecorder = (options?: VoiceRecorderOptions) => {
  const isRecording = ref(false);
  const isUsingNativeBridge = ref(false);

  let mediaStream: MediaStream | null = null;
  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];

  const hasNativeBridge = (): boolean => {
    return typeof window !== "undefined" && !!window.NativeBridge;
  };

  const getBestRecorderMimeType = (): string | undefined => {
    if (typeof MediaRecorder === "undefined") return undefined;
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
    ];
    return candidates.find((type) => MediaRecorder.isTypeSupported(type));
  };

  const mergeToMono = (buffer: AudioBuffer): Float32Array => {
    if (buffer.numberOfChannels === 1) return buffer.getChannelData(0);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    const output = new Float32Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      output[i] = (left[i] + right[i]) / 2;
    }
    return output;
  };

  const resampleLinear = (
    input: Float32Array,
    fromRate: number,
    toRate: number
  ): Float32Array => {
    if (fromRate === toRate) return input;
    const ratio = fromRate / toRate;
    const newLength = Math.round(input.length / ratio);
    const output = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const index = i * ratio;
      const before = Math.floor(index);
      const after = Math.min(before + 1, input.length - 1);
      const weight = index - before;
      output[i] = input[before] * (1 - weight) + input[after] * weight;
    }
    return output;
  };

  const floatTo16BitPCM = (samples: Float32Array): Int16Array => {
    const out = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  };

  const normalizeToPcm16kRaw = async (rawBlob: Blob): Promise<Blob> => {
    const arrayBuffer = await rawBlob.arrayBuffer();
    const AudioCtx =
      window.AudioContext || (window as any).webkitAudioContext;
    const audioCtx = new AudioCtx();
    try {
      const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
      const mono = mergeToMono(decoded);
      const sampled = resampleLinear(mono, decoded.sampleRate, 16000);
      const pcm16 = floatTo16BitPCM(sampled);
      return new Blob([pcm16.buffer], { type: "application/octet-stream" });
    } finally {
      await audioCtx.close();
    }
  };

  // --- NativeBridge recording ---

  const startNativeRecording = async (): Promise<void> => {
    const bridge = window.NativeBridge!;
    const perm = await bridge.requestAudioPermission();
    if (!perm.data.granted) {
      throw new Error("麦克风权限被拒绝");
    }
    const res = await bridge.startRecording();
    if (!res.success) {
      throw new Error("原生录音启动失败");
    }
  };

  const stopNativeRecording = async (): Promise<Blob> => {
    const bridge = window.NativeBridge!;
    const res = await bridge.stopRecording();
    const filePath = res.data.filePath;
    const fileUrl = `file://${filePath}`;
    const response = await fetch(fileUrl);
    return await response.blob();
  };

  const cancelNativeRecording = async (): Promise<void> => {
    const bridge = window.NativeBridge!;
    await bridge.cancelRecording();
  };

  // --- Browser MediaRecorder recording ---

  const startBrowserRecording = async (): Promise<void> => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      throw new Error("当前浏览器不支持录音");
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStream = stream;
    audioChunks = [];

    const mimeType = getBestRecorderMimeType();
    mediaRecorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.start(200);
  };

  const stopBrowserRecording = (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!mediaRecorder) {
        reject(new Error("未在录音"));
        return;
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
        cleanupBrowserStream();
        if (audioBlob.size > 0) {
          resolve(audioBlob);
        } else {
          reject(new Error("录音数据为空"));
        }
      };

      mediaRecorder.stop();
    });
  };

  const cancelBrowserRecording = (): void => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.onstop = null;
      mediaRecorder.stop();
    }
    cleanupBrowserStream();
  };

  const cleanupBrowserStream = () => {
    mediaStream?.getTracks().forEach((track) => track.stop());
    mediaStream = null;
    mediaRecorder = null;
    audioChunks = [];
  };

  // --- Public API ---

  const startRecording = async (): Promise<void> => {
    if (isRecording.value) return;

    isUsingNativeBridge.value = hasNativeBridge();

    try {
      if (isUsingNativeBridge.value) {
        await startNativeRecording();
      } else {
        await startBrowserRecording();
      }
      isRecording.value = true;
      options?.onRecordingStart?.();
    } catch (err: any) {
      options?.onError?.(err?.message || "录音启动失败");
      throw err;
    }
  };

  const stopRecording = async (): Promise<Blob> => {
    if (!isRecording.value) throw new Error("未在录音");

    try {
      const blob = isUsingNativeBridge.value
        ? await stopNativeRecording()
        : await stopBrowserRecording();
      isRecording.value = false;
      options?.onRecordingStop?.();
      return blob;
    } catch (err: any) {
      isRecording.value = false;
      options?.onRecordingStop?.();
      options?.onError?.(err?.message || "停止录音失败");
      throw err;
    }
  };

  const cancelRecording = async (): Promise<void> => {
    if (!isRecording.value) return;

    try {
      if (isUsingNativeBridge.value) {
        await cancelNativeRecording();
      } else {
        cancelBrowserRecording();
      }
    } finally {
      isRecording.value = false;
      options?.onRecordingStop?.();
    }
  };

  const cleanup = () => {
    if (isRecording.value) {
      cancelRecording();
    }
    cleanupBrowserStream();
  };

  return {
    isRecording,
    isUsingNativeBridge,
    startRecording,
    stopRecording,
    cancelRecording,
    normalizeToPcm16kRaw,
    cleanup,
  };
};
