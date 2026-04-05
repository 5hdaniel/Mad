/**
 * Model Manager Service
 * Manages downloading, listing, and deleting Gemma 4 GGUF model files.
 * Models are stored in the app's userData directory.
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import { GEMMA_MODELS, GemmaModel } from './types';
import logService from '../logService';

/**
 * System hardware capabilities for model recommendation.
 */
export interface SystemCapabilities {
  totalRAM: number; // MB
  availableRAM: number; // MB
  cpuCores: number;
  gpuDetected: boolean;
  platform: string;
}

/**
 * Download progress callback data.
 */
export interface DownloadProgress {
  modelId: GemmaModel;
  percent: number;
  bytesDownloaded: number;
  totalBytes: number;
  speed: number; // bytes per second
}

/**
 * Model info for a downloaded model.
 */
export interface DownloadedModelInfo {
  modelId: GemmaModel;
  path: string;
  sizeBytes: number;
  downloadedAt: string;
}

/**
 * Manages local GGUF model files — download, delete, list, recommend.
 */
export class ModelManagerService {
  private modelsDir: string;
  private activeDownload: AbortController | null = null;

  constructor() {
    this.modelsDir = path.join(app.getPath('userData'), 'models');
    this.ensureModelsDir();
  }

  /**
   * Ensure the models directory exists.
   */
  private ensureModelsDir(): void {
    if (!fs.existsSync(this.modelsDir)) {
      fs.mkdirSync(this.modelsDir, { recursive: true });
      logService.info('Created models directory', 'ModelManager', { path: this.modelsDir });
    }
  }

  /**
   * Get the full path for a model's GGUF file.
   */
  getModelPath(modelId: GemmaModel): string {
    const modelDef = GEMMA_MODELS[modelId];
    return path.join(this.modelsDir, modelDef.ggufFile);
  }

  /**
   * Check if a model is already downloaded.
   */
  isModelDownloaded(modelId: GemmaModel): boolean {
    const modelPath = this.getModelPath(modelId);
    return fs.existsSync(modelPath);
  }

  /**
   * List all downloaded models with their info.
   */
  getDownloadedModels(): DownloadedModelInfo[] {
    const downloaded: DownloadedModelInfo[] = [];
    for (const modelId of Object.keys(GEMMA_MODELS) as GemmaModel[]) {
      const modelPath = this.getModelPath(modelId);
      if (fs.existsSync(modelPath)) {
        const stats = fs.statSync(modelPath);
        downloaded.push({
          modelId,
          path: modelPath,
          sizeBytes: stats.size,
          downloadedAt: stats.mtime.toISOString(),
        });
      }
    }
    return downloaded;
  }

  /**
   * Download a model from HuggingFace.
   * Progress is reported via the onProgress callback.
   * Returns the path to the downloaded file.
   */
  async downloadModel(
    modelId: GemmaModel,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<string> {
    const modelDef = GEMMA_MODELS[modelId];
    const destPath = this.getModelPath(modelId);
    const tempPath = destPath + '.download';

    // Check if already downloaded
    if (fs.existsSync(destPath)) {
      logService.info(`Model already downloaded: ${modelId}`, 'ModelManager');
      return destPath;
    }

    // Build HuggingFace download URL
    const url = `https://huggingface.co/${modelDef.huggingFaceRepo}/resolve/main/${modelDef.ggufFile}`;

    logService.info(`Starting download: ${modelId} from ${url}`, 'ModelManager');

    // Set up abort controller
    this.activeDownload = new AbortController();
    const { signal } = this.activeDownload;

    // Check for partial download (resume support)
    let startByte = 0;
    if (fs.existsSync(tempPath)) {
      const stats = fs.statSync(tempPath);
      startByte = stats.size;
      logService.info(`Resuming download from byte ${startByte}`, 'ModelManager');
    }

    return new Promise<string>((resolve, reject) => {
      const fileStream = fs.createWriteStream(tempPath, {
        flags: startByte > 0 ? 'a' : 'w',
      });

      const makeRequest = (requestUrl: string, redirectCount = 0) => {
        if (redirectCount > 5) {
          reject(new Error('Too many redirects'));
          return;
        }

        const urlObj = new URL(requestUrl);
        const options: https.RequestOptions = {
          hostname: urlObj.hostname,
          path: urlObj.pathname + urlObj.search,
          method: 'GET',
          headers: {
            'User-Agent': 'Keepr-Desktop/1.0',
            ...(startByte > 0 ? { Range: `bytes=${startByte}-` } : {}),
          },
        };

        const req = https.request(options, (res) => {
          // Handle redirects (HuggingFace uses them)
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            makeRequest(res.headers.location, redirectCount + 1);
            return;
          }

          if (res.statusCode && res.statusCode >= 400) {
            fileStream.close();
            reject(new Error(`Download failed with HTTP ${res.statusCode}`));
            return;
          }

          const totalBytes = parseInt(res.headers['content-length'] ?? '0', 10) + startByte;
          let bytesDownloaded = startByte;
          let lastProgressTime = Date.now();
          let lastProgressBytes = startByte;

          res.on('data', (chunk: Buffer) => {
            bytesDownloaded += chunk.length;

            // Calculate speed every 500ms
            const now = Date.now();
            const elapsed = now - lastProgressTime;
            let speed = 0;
            if (elapsed > 500) {
              speed = ((bytesDownloaded - lastProgressBytes) / elapsed) * 1000;
              lastProgressTime = now;
              lastProgressBytes = bytesDownloaded;
            }

            if (onProgress) {
              onProgress({
                modelId,
                percent: totalBytes > 0 ? Math.round((bytesDownloaded / totalBytes) * 100) : 0,
                bytesDownloaded,
                totalBytes,
                speed,
              });
            }
          });

          res.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close();
            // Rename temp file to final path
            fs.renameSync(tempPath, destPath);
            logService.info(`Download complete: ${modelId}`, 'ModelManager');
            this.activeDownload = null;
            resolve(destPath);
          });
        });

        req.on('error', (err) => {
          fileStream.close();
          this.activeDownload = null;
          reject(err);
        });

        // Wire up abort
        if (signal) {
          signal.addEventListener('abort', () => {
            req.destroy();
            fileStream.close();
            this.activeDownload = null;
            reject(new Error('Download cancelled'));
          });
        }

        req.end();
      };

      makeRequest(url);
    });
  }

  /**
   * Cancel an in-progress download.
   */
  cancelDownload(): void {
    if (this.activeDownload) {
      this.activeDownload.abort();
      this.activeDownload = null;
      logService.info('Download cancelled', 'ModelManager');
    }
  }

  /**
   * Delete a downloaded model to free disk space.
   */
  deleteModel(modelId: GemmaModel): void {
    const modelPath = this.getModelPath(modelId);
    if (fs.existsSync(modelPath)) {
      fs.unlinkSync(modelPath);
      logService.info(`Model deleted: ${modelId}`, 'ModelManager');
    }

    // Also clean up any partial downloads
    const tempPath = modelPath + '.download';
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }

  /**
   * Get system hardware capabilities.
   */
  getSystemCapabilities(): SystemCapabilities {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    return {
      totalRAM: Math.round(totalMem / (1024 * 1024)),
      availableRAM: Math.round(freeMem / (1024 * 1024)),
      cpuCores: os.cpus().length,
      gpuDetected: false, // node-llama-cpp detects GPU automatically during inference
      platform: process.platform,
    };
  }

  /**
   * Recommend a model based on system RAM.
   */
  getRecommendedModel(): GemmaModel {
    const { totalRAM } = this.getSystemCapabilities();

    if (totalRAM >= 24576) {
      // 24GB+ → 26B MoE
      return 'gemma-4-26b-a4b-it-q4';
    } else if (totalRAM >= 8192) {
      // 8GB+ → E4B (recommended)
      return 'gemma-4-e4b-it-q4';
    } else {
      // <8GB → E2B (lightweight)
      return 'gemma-4-e2b-it-q4';
    }
  }

  /**
   * Get the models directory path.
   */
  getModelsDir(): string {
    return this.modelsDir;
  }
}
