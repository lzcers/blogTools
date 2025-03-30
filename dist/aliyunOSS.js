"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ali_oss_1 = __importDefault(require("ali-oss"));
const config_1 = require("./config");
const client = new ali_oss_1.default(config_1.ossConfig);
async function uploadOSS(objList, targetPath = "") {
    try {
        console.log(`开始上传静态资源至 OSS,总共${objList.length}个文件.`);
        let remainCount = objList.length;
        await Promise.all(objList.map(async (obj) => {
            try {
                await client.put(targetPath + obj.name, obj.data);
                remainCount--;
                console.log(`[${obj.name}] 上传成功,剩余:${remainCount}`);
            }
            catch (e) {
                console.error("上传失败:" + obj.name);
                console.error(e);
            }
        }));
        console.log("静态资源上传至 OSS 成功!");
    }
    catch (e) {
        console.error("静态资源上传至 OSS 失败!");
        console.error(e);
    }
}
exports.default = uploadOSS;
