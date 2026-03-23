export type UploadTransform = "none" | "markdown";

export interface BufferUploadObject {
    name: string;
    data: Buffer | Uint8Array;
}

export interface FileUploadObject {
    name: string;
    filePath: string;
    transform?: UploadTransform;
}

export type UploadObject = BufferUploadObject | FileUploadObject;

export interface OssClientConfig {
    region: string;
    accessKeyId: string;
    accessKeySecret: string;
    bucket: string;
}

export interface UploadWorkerData {
    ossConfig: OssClientConfig;
    targetPath: string;
}

export interface UploadWorkerRequestUpload {
    type: "upload";
    taskId: number;
    obj: UploadObject;
}

export interface UploadWorkerRequestShutdown {
    type: "shutdown";
}

export type UploadWorkerRequest =
    | UploadWorkerRequestUpload
    | UploadWorkerRequestShutdown;

export interface UploadWorkerSuccessMessage {
    type: "success";
    taskId: number;
    name: string;
}

export interface UploadWorkerErrorMessage {
    type: "error";
    taskId: number;
    name: string;
    error: string;
}

export type UploadWorkerResponse =
    | UploadWorkerSuccessMessage
    | UploadWorkerErrorMessage;
