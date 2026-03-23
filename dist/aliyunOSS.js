"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = uploadOSS;
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const worker_threads_1 = require("worker_threads");
const cliUI_1 = require("./cliUI");
const config_1 = require("./config");
const DEFAULT_WORKER_LIMIT = 8;
const WORKER_COUNT_ENV = "BLOG_UPLOAD_WORKERS";
function getAvailableWorkerCount() {
    const availableCount = typeof os_1.default.availableParallelism === "function"
        ? os_1.default.availableParallelism()
        : os_1.default.cpus().length;
    return Math.max(1, Math.min(DEFAULT_WORKER_LIMIT, availableCount));
}
function resolveWorkerCount(taskCount) {
    if (taskCount <= 0) {
        return 0;
    }
    const configuredCount = Number.parseInt(process.env[WORKER_COUNT_ENV] ?? "", 10);
    if (Number.isFinite(configuredCount) && configuredCount > 0) {
        return Math.min(taskCount, configuredCount);
    }
    return Math.min(taskCount, getAvailableWorkerCount());
}
function getWorkerScriptPath() {
    return path_1.default.resolve(__dirname, "uploadWorker.js");
}
async function runUploadWorkers(objList, targetPath, options) {
    const workerCount = resolveWorkerCount(objList.length);
    const taskQueue = objList.map((obj, taskId) => ({ obj, taskId }));
    const failedUploads = [];
    let completedCount = 0;
    const progress = (0, cliUI_1.createUploadProgress)({
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
        await new Promise((resolve, reject) => {
            const workers = new Set();
            const activeTasks = new Map();
            const workerScriptPath = getWorkerScriptPath();
            const workerData = {
                ossConfig: (0, config_1.getOssConfig)(),
                targetPath
            };
            let settled = false;
            let shuttingDown = false;
            const rejectAll = (error) => {
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
            const shutdownWorker = (worker) => {
                activeTasks.set(worker, null);
                const shutdownMessage = { type: "shutdown" };
                worker.postMessage(shutdownMessage);
            };
            const assignNextTask = (worker) => {
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
                const uploadMessage = {
                    type: "upload",
                    taskId: nextTask.taskId,
                    obj: nextTask.obj
                };
                worker.postMessage(uploadMessage);
            };
            for (let index = 0; index < workerCount; index++) {
                const worker = new worker_threads_1.Worker(workerScriptPath, { workerData });
                workers.add(worker);
                activeTasks.set(worker, null);
                worker.on("message", (message) => {
                    const currentTask = activeTasks.get(worker);
                    if (!currentTask) {
                        return;
                    }
                    activeTasks.set(worker, null);
                    completedCount++;
                    if (message.type === "success") {
                        progress.onSuccess(message.name);
                    }
                    else {
                        failedUploads.push({
                            name: message.name,
                            error: message.error
                        });
                        progress.onFailure(message.name, message.error);
                    }
                    assignNextTask(worker);
                    maybeResolve();
                });
                worker.on("error", error => {
                    rejectAll(error instanceof Error ? error : new Error(String(error)));
                });
                worker.on("exit", code => {
                    workers.delete(worker);
                    const currentTask = activeTasks.get(worker);
                    activeTasks.delete(worker);
                    if (shuttingDown) {
                        return;
                    }
                    if (code !== 0) {
                        const taskName = currentTask?.obj.name;
                        rejectAll(new Error(taskName
                            ? `上传线程异常退出(${code}),任务:${taskName}`
                            : `上传线程异常退出(${code})`));
                    }
                });
                assignNextTask(worker);
            }
        });
    }
    catch (error) {
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
async function uploadOSS(objList, targetPath = "", options) {
    const summary = await runUploadWorkers(objList, targetPath, options);
    if (summary.failedUploads.length > 0) {
        throw new Error(`共有${summary.failedUploads.length}个文件上传失败。`);
    }
    return summary;
}
