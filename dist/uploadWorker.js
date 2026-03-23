"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = __importDefault(require("fs/promises"));
const ali_oss_1 = __importDefault(require("ali-oss"));
const worker_threads_1 = require("worker_threads");
const utils_1 = require("./utils");
const port = worker_threads_1.parentPort;
if (!port) {
    throw new Error("上传 worker 缺少 parentPort");
}
const { ossConfig, targetPath } = worker_threads_1.workerData;
const client = new ali_oss_1.default(ossConfig);
async function resolveUploadData(obj) {
    if ("data" in obj) {
        return Buffer.isBuffer(obj.data) ? obj.data : Buffer.from(obj.data);
    }
    if (obj.transform === "markdown") {
        const content = await promises_1.default.readFile(obj.filePath, "utf-8");
        return Buffer.from((0, utils_1.replacePostAssetUrl)(content));
    }
    return promises_1.default.readFile(obj.filePath);
}
function serializeError(error) {
    if (error instanceof Error) {
        return error.stack || error.message;
    }
    return String(error);
}
port.on("message", async (message) => {
    if (message.type === "shutdown") {
        port.close();
        process.exit(0);
    }
    try {
        const data = await resolveUploadData(message.obj);
        await client.put(targetPath + message.obj.name, data);
        const successMessage = {
            type: "success",
            taskId: message.taskId,
            name: message.obj.name
        };
        port.postMessage(successMessage);
    }
    catch (error) {
        const errorMessage = {
            type: "error",
            taskId: message.taskId,
            name: message.obj.name,
            error: serializeError(error)
        };
        port.postMessage(errorMessage);
    }
});
