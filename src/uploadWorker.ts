import fs from "fs/promises";
import OSS from "ali-oss";
import { parentPort, workerData } from "worker_threads";
import { replacePostAssetUrl } from "./utils";
import type {
    UploadObject,
    UploadWorkerData,
    UploadWorkerErrorMessage,
    UploadWorkerRequest,
    UploadWorkerSuccessMessage
} from "./uploadTypes";

const port = parentPort;

if (!port) {
    throw new Error("上传 worker 缺少 parentPort");
}

const { ossConfig, targetPath } = workerData as UploadWorkerData;
const client = new OSS(ossConfig);

async function resolveUploadData(obj: UploadObject): Promise<Buffer> {
    if ("data" in obj) {
        return Buffer.isBuffer(obj.data) ? obj.data : Buffer.from(obj.data);
    }

    if (obj.transform === "markdown") {
        const content = await fs.readFile(obj.filePath, "utf-8");
        return Buffer.from(replacePostAssetUrl(content));
    }

    return fs.readFile(obj.filePath);
}

function serializeError(error: unknown): string {
    if (error instanceof Error) {
        return error.stack || error.message;
    }

    return String(error);
}

port.on("message", async (message: UploadWorkerRequest) => {
    if (message.type === "shutdown") {
        port.close();
        process.exit(0);
    }

    try {
        const data = await resolveUploadData(message.obj);
        await client.put(targetPath + message.obj.name, data);

        const successMessage: UploadWorkerSuccessMessage = {
            type: "success",
            taskId: message.taskId,
            name: message.obj.name
        };
        port.postMessage(successMessage);
    } catch (error) {
        const errorMessage: UploadWorkerErrorMessage = {
            type: "error",
            taskId: message.taskId,
            name: message.obj.name,
            error: serializeError(error)
        };
        port.postMessage(errorMessage);
    }
});
