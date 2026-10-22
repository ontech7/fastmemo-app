export interface DownloadStatus {
  /** "missing": the system no longer knows the download (removed from its notification, or already finished here). */
  status: "pending" | "running" | "paused" | "successful" | "failed" | "missing";
  /** Bytes written so far, and the file's size (-1 until the server said it). */
  downloaded: number;
  total: number;
  /** Why it's paused or failed: DownloadManager's PAUSED_* / ERROR_* codes. */
  reason: number;
}

/**
 * Model downloads through Android's DownloadManager: they go on with the screen off, the app in the background or closed,
 * and resume after the network drops, with their progress in a system notification.
 */
export interface FastmemoDownloadsApi {
  /** The folder models are kept in (a file:// URI ending in "/"): the app's own folder on the shared storage. */
  modelsDir(): string;
  /** Starts downloading `url` into a staging folder, under `fileName`; returns the download's id. */
  startAsync(url: string, fileName: string, title: string, description: string): Promise<number>;
  queryAsync(id: number): Promise<DownloadStatus>;
  /** Moves a finished download from the staging folder into the models folder; false when it isn't there. */
  finishAsync(id: number, fileName: string): Promise<boolean>;
  /** Stops a download and deletes what it wrote. */
  cancelAsync(id: number, fileName: string): Promise<void>;
  /** Deletes a file of the models folder (expo-file-system can't there). */
  deleteAsync(fileName: string): Promise<void>;
  /** Deletes whatever the staging folder holds: downloads nobody follows any more. */
  clearStagingAsync(): Promise<void>;
}
