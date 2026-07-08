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

  const nativeBridgeFromHost = (): NativeBridge | null => {
    if (typeof window === "undefined" || !window.NativeBridgeHost) return null;

    const invoke = async <T>(
      method: keyof NativeBridgeHost,
      args: unknown[] = []
    ): Promise<NativeBridgeResult<T>> => {
      const hostMethod = window.NativeBridgeHost?.[method];
      if (typeof hostMethod !== "function") {
        throw new Error("原生录音接口未就绪");
      }

      const raw = hostMethod.apply(window.NativeBridgeHost, args as never[]);
      const result =
        typeof raw === "string"
          ? (JSON.parse(raw) as NativeBridgeResult<T>)
          : (raw as NativeBridgeResult<T>);

      if (!result?.success) {
        const err = new Error(result?.message || "原生录音接口调用失败") as Error & {
          code?: string;
          result?: NativeBridgeResult<T>;
        };
        err.code = (result as NativeBridgeResult<T> & { code?: string })?.code;
        err.result = result;
        throw err;
      }

      return result;
    };

    return {
      requestAudioPermission: () =>
        invoke<NativeBridgePermissionResult>("requestAudioPermission"),
      startRecording: (options?: { format?: "aac" | "wav" }) =>
        invoke<NativeBridgeStartResult>("startRecording", [
          JSON.stringify(options || {}),
        ]),
      stopRecording: () => invoke<NativeBridgeStopResult>("stopRecording"),
      cancelRecording: () =>
        invoke<{ message: string }>("cancelRecording"),
      getRecordingState: () =>
        invoke<NativeBridgeStateResult>("getRecordingState"),
      onAudioPermissionResult: (cb: (detail: NativeBridgePermissionResult) => void) => {
        window.addEventListener("audioPermissionResult", (e) => {
          cb((e as CustomEvent<NativeBridgePermissionResult>).detail);
        });
      },
    };
  };

  const getNativeBridge = (): NativeBridge | null => {
    if (typeof window === "undefined") return null;
    return window.NativeBridge || nativeBridgeFromHost();
  };

  const hasNativeBridge = (): boolean => {
    return !!getNativeBridge();
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

  const waitForAudioPermissionResult = (
    bridge: NativeBridge,
    timeoutMs = 30000
  ): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error("麦克风权限申请超时"));
      }, timeoutMs);

      bridge.onAudioPermissionResult((detail) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(!!detail.granted);
      });
    });
  };

  const ensureNativeAudioPermission = async (
    bridge: NativeBridge
  ): Promise<boolean> => {
    const perm = await bridge.requestAudioPermission();
    if (perm.data.granted) {
      return true;
    }
    return waitForAudioPermissionResult(bridge);
  };

  const startNativeRecording = async (): Promise<void> => {
    const bridge = getNativeBridge();
    if (!bridge) {
      throw new Error("原生录音接口未就绪");
    }

    const granted = await ensureNativeAudioPermission(bridge);
    if (!granted) {
      throw new Error("麦克风权限被拒绝");
    }
    const res = await bridge.startRecording({ format: "aac" });
    if (!res.success) {
      throw new Error(res.message || "原生录音启动失败");
    }
  };

  const stopNativeRecording = async (): Promise<Blob> => {
    const bridge = getNativeBridge();
    if (!bridge) {
      throw new Error("原生录音接口未就绪");
    }
    const res = await bridge.stopRecording();
    const filePath = res.data.filePath;
    const fileUrl = `file://${filePath}`;
    const response = await fetch(fileUrl);
    return await response.blob();
  };

  const cancelNativeRecording = async (): Promise<void> => {
    const bridge = getNativeBridge();
    if (bridge) {
      await bridge.cancelRecording();
    }
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
