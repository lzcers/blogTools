import os from "os";
import path from "path";
import { Worker } from "worker_threads";
import { createUploadProgress } from "./cliUI";
import { getOssConfig } from "./config";
import type {
    UploadObject,
    UploadWorkerData,
    UploadWorkerRequest,
    UploadWorkerResponse
} from "./uploadTypes";

const DEFAULT_WORKER_LIMIT = 8;
const WORKER_COUNT_ENV = "BLOG_UPLOAD_WORKERS";

interface PendingTask {
    taskId: number;
    obj: UploadObject;
}

interface FailedUpload {
    name: string;
    error: string;
}

interface UploadRunOptions {
    label: string;
    sourcePath: string;
    displayTargetPath?: string;
}

interface UploadSummary {
    total: number;
    workerCount: number;
    successfulCount: number;
    failedUploads: FailedUpload[];
}

function getAvailableWorkerCount(): number {
    const availableCount = typeof os.availableParallelism === "function"
        ? os.availableParallelism()
        : os.cpus().length;

    return Math.max(1, Math.min(DEFAULT_WORKER_LIMIT, availableCount));
}

function resolveWorkerCount(taskCount: number): number {
    if (taskCount <= 0) {
        return 0;
    }

    const configuredCount = Number.parseInt(process.env[WORKER_COUNT_ENV] ?? "", 10);
    if (Number.isFinite(configuredCount) && configuredCount > 0) {
        return Math.min(taskCount, configuredCount);
    }

    return Math.min(taskCount, getAvailableWorkerCount());
}

function getWorkerScriptPath(): string {
    return path.resolve(__dirname, "uploadWorker.js");
}

async function runUploadWorkers(
    objList: UploadObject[],
    targetPath: string,
    options: UploadRunOptions
): Promise<UploadSummary> {
    const workerCount = resolveWorkerCount(objList.length);
    const taskQueue: PendingTask[] = objList.map((obj, taskId) => ({ obj, taskId }));
    const failedUploads: FailedUpload[] = [];
    let completedCount = 0;
    const progress = createUploadProgress({
        label: options.label,
        sourcePath: options.sourcePath,
        targetPath: options.displayTargetPath ?? (targetPath || "/"),
        total: objList.length,
        workerCount
    });

    progress.start();

    if (workerCount === 0) {
        progress.finish();
        return {
            total: objList.length,
            workerCount,
            successfulCount: 0,
            failedUploads
        };
    }

    try {
        await new Promise<void>((resolve, reject) => {
            const workers = new Set<Worker>();
            const activeTasks = new Map<Worker, PendingTask | null>();
            const workerScriptPath = getWorkerScriptPath();
            const workerData: UploadWorkerData = {
                ossConfig: getOssConfig(),
                targetPath
            };
            let settled = false;
            let shuttingDown = false;

            const rejectAll = (error: Error) => {
                if (settled) {
                    return;
                }

                settled = true;
                shuttingDown = true;

                for (const worker of workers) {
                    worker.removeAllListeners("message");
                    worker.removeAllListeners("error");
                    worker.removeAllListeners("exit");
                    worker.terminate().catch(() => undefined);
                }

                reject(error);
            };

            const maybeResolve = () => {
                if (settled) {
                    return;
                }

                if (completedCount !== objList.length) {
                    return;
                }

                const hasActiveTask = [...activeTasks.values()].some(task => task !== null);
                if (hasActiveTask) {
                    return;
                }

                settled = true;
                resolve();
            };

            const shutdownWorker = (worker: Worker) => {
                activeTasks.set(worker, null);
                const shutdownMessage: UploadWorkerRequest = { type: "shutdown" };
                worker.postMessage(shutdownMessage);
            };

            const assignNextTask = (worker: Worker) => {
                if (settled) {
                    return;
                }

                const nextTask = taskQueue.shift();
                if (!nextTask) {
                    shutdownWorker(worker);
                    maybeResolve();
                    return;
                }

                activeTasks.set(worker, nextTask);
                const uploadMessage: UploadWorkerRequest = {
                    type: "upload",
                    taskId: nextTask.taskId,
                    obj: nextTask.obj
                };
                worker.postMessage(uploadMessage);
            };

            for (let index = 0; index < workerCount; index++) {
                const worker = new Worker(workerScriptPath, { workerData });
                workers.add(worker);
                activeTasks.set(worker, null);

                worker.on("message", (message: UploadWorkerResponse) => {
                    const currentTask = activeTasks.get(worker);
                    if (!currentTask) {
                        return;
                    }

                    activeTasks.set(worker, null);
                    completedCount++;

                    if (message.type === "success") {
                        progress.onSuccess(message.name);
                    } else {
                        failedUploads.push({
                            name: message.name,
                            error: message.error
                        });
                        progress.onFailure(message.name, message.error);
                    }

                    assignNextTask(worker);
                    maybeResolve();
                });

                worker.on("error", (error: Error) => {
                    rejectAll(error instanceof Error ? error : new Error(String(error)));
                });

                worker.on("exit", (code: number) => {
                    workers.delete(worker);
                    const currentTask = activeTasks.get(worker);
                    activeTasks.delete(worker);

                    if (shuttingDown) {
                        return;
                    }

                    if (code !== 0) {
                        const taskName = currentTask?.obj.name;
                        rejectAll(new Error(
                            taskName
                                ? `上传线程异常退出(${code}),任务:${taskName}`
                                : `上传线程异常退出(${code})`
                        ));
                    }
                });

                assignNextTask(worker);
            }
        });
    } catch (error) {
        progress.abort(error);
        throw error;
    }

    progress.finish();

    return {
        total: objList.length,
        workerCount,
        successfulCount: objList.length - failedUploads.length,
        failedUploads
    };
}

export default async function uploadOSS(
    objList: UploadObject[],
    targetPath = "",
    options: UploadRunOptions
): Promise<UploadSummary> {
    const summary = await runUploadWorkers(objList, targetPath, options);

    if (summary.failedUploads.length > 0) {
        throw new Error(`共有${summary.failedUploads.length}个文件上传失败。`);
    }

    return summary;
}
