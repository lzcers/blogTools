"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = uploadOSS;
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const worker_threads_1 = require("worker_threads");
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
async function runUploadWorkers(objList, targetPath) {
    const workerCount = resolveWorkerCount(objList.length);
    const taskQueue = objList.map((obj, taskId) => ({ obj, taskId }));
    const failedUploads = [];
    let remainCount = objList.length;
    let completedCount = 0;
    console.log(`开始上传静态资源至 OSS,总共${objList.length}个文件,使用${workerCount}个线程.`);
    if (workerCount === 0) {
        return failedUploads;
    }
    await new Promise((resolve, reject) => {
        const workers = new Set();
        const activeTasks = new Map();
        const workerScriptPath = getWorkerScriptPath();
        const workerData = {
            ossConfig: config_1.ossConfig,
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
                remainCount--;
                if (message.type === "success") {
                    console.log(`[${message.name}] 上传成功,剩余:${remainCount}`);
                }
                else {
                    failedUploads.push({
                        name: message.name,
                        error: message.error
                    });
                    console.error(`上传失败:${message.name}`);
                    console.error(message.error);
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
    return failedUploads;
}
async function uploadOSS(objList, targetPath = "") {
    try {
        const failedUploads = await runUploadWorkers(objList, targetPath);
        if (failedUploads.length > 0) {
            throw new Error(`共有${failedUploads.length}个文件上传失败。`);
        }
        console.log("静态资源上传至 OSS 成功!");
    }
    catch (e) {
        console.error("静态资源上传至 OSS 失败!");
        console.error(e);
        throw e;
    }
}
