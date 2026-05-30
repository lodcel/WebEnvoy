export const resolveXhsControlledUploadPlatformCaptureTimeoutMs = (forwardResponseTimeoutMs) => Math.max(1, Math.min(60_000, Math.floor(forwardResponseTimeoutMs)));
