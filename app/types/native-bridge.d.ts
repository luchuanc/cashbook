interface NativeBridgeResult<T = any> {
  success: boolean;
  data: T;
  message?: string;
}

interface NativeBridgePermissionResult {
  granted: boolean;
}

interface NativeBridgeStartResult {
  message: string;
  format: string;
}

interface NativeBridgeStopResult {
  filePath: string;
  duration: number;
  fileSize: number;
  format: string;
}

interface NativeBridgeStateResult {
  state: "idle" | "recording";
  filePath?: string;
  duration?: number;
}

interface NativeBridge {
  requestAudioPermission(): Promise<NativeBridgeResult<NativeBridgePermissionResult>>;
  startRecording(options?: { format?: "aac" | "wav" }): Promise<NativeBridgeResult<NativeBridgeStartResult>>;
  stopRecording(): Promise<NativeBridgeResult<NativeBridgeStopResult>>;
  cancelRecording(): Promise<NativeBridgeResult<{ message: string }>>;
  getRecordingState(): Promise<NativeBridgeResult<NativeBridgeStateResult>>;
  onAudioPermissionResult(cb: (detail: NativeBridgePermissionResult) => void): void;
}

declare interface Window {
  NativeBridge?: NativeBridge;
}
