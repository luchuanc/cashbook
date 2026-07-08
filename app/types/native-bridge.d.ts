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

interface NativeBridgeRecordingFileResult {
  fileName: string;
  mimeType: string;
  base64: string;
  fileSize: number;
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
  readRecordingFile?(filePath: string): Promise<NativeBridgeResult<NativeBridgeRecordingFileResult>>;
  onAudioPermissionResult(cb: (detail: NativeBridgePermissionResult) => void): void;
}

interface NativeBridgeHost {
  getPackageInfo?(): string;
  requestAudioPermission(): string;
  startRecording(optionsJson?: string): string;
  stopRecording(): string;
  cancelRecording(): string;
  getRecordingState(): string;
  readRecordingFile?(filePath: string): string;
}

declare interface Window {
  NativeBridge?: NativeBridge;
  NativeBridgeHost?: NativeBridgeHost;
}
