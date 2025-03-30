#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const aliyunOSS_1 = __importDefault(require("./aliyunOSS"));
const config_1 = require("./config");
const utils_1 = require("./utils");
const path_1 = __importDefault(require("path"));
async function uploadPostsToOSS() {
    const postsMetadata = await (0, utils_1.genPostMetadatalist)(config_1.blogPath);
    const postList = (0, utils_1.getPostList)(config_1.blogPath);
    try {
        const files = [];
        for (const post of postList) {
            const filePath = path_1.default.format(post);
            const objName = path_1.default.relative(config_1.blogPath, filePath).replace(/\\/g, '/');
            if (post.ext === '.md') {
                const content = fs_1.default.readFileSync(filePath, 'utf-8');
                const processedContent = (0, utils_1.replacePostAssetUrl)(content);
                files.push({
                    name: '/articles/' + objName,
                    data: Buffer.from(processedContent)
                });
            }
            else {
                const data = fs_1.default.readFileSync(filePath);
                files.push({
                    name: '/articles/' + objName,
                    data
                });
            }
        }
        // 上传所有博文和元数据
        files.push({
            name: '/articles/postsMetadata.json',
            data: Buffer.from(JSON.stringify(postsMetadata))
        });
        await (0, aliyunOSS_1.default)(files);
    }
    catch (e) {
        console.error("上传博文失败！", e);
    }
}
console.log(`
    ----------------------------------------
                Ksana 博客自用工具
    ----------------------------------------
        uo    := 上传博文至 OSS
`);
const commandList = {
    uo: uploadPostsToOSS
};
const argv = process.argv.slice(2);
// 第一个参数是命令， 后面跟命令的参数
// 只实现 commandName arg1 arg2 arg3 ... 的形式
const [commandName] = argv;
if (!!commandName) {
    const command = commandList[commandName];
    command && command();
}
