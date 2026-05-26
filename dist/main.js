#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const aliyunOSS_1 = __importDefault(require("./aliyunOSS"));
const config_1 = require("./config");
const cliUI_1 = require("./cliUI");
const utils_1 = require("./utils");
const path_1 = __importDefault(require("path"));
//  更新博文至 OSS
async function uploadPostsToOSS(blogPath = (0, config_1.getConfigBlogPath)()) {
    const postsMetadata = await (0, utils_1.genPostMetadatalist)(blogPath);
    const postList = (0, utils_1.getPostList)(blogPath);
    const files = postList.map(post => {
        const filePath = path_1.default.format(post);
        const objName = path_1.default.relative(blogPath, filePath).replace(/\\/g, '/');
        if (post.ext === '.md') {
            return {
                name: '/articles/' + objName,
                filePath,
                transform: 'markdown'
            };
        }
        return {
            name: '/articles/' + objName,
            filePath
        };
    });
    // 上传所有博文和元数据
    files.push({
        name: '/articles/postsMetadata.json',
        data: Buffer.from(JSON.stringify(postsMetadata))
    });
    (0, cliUI_1.printInfo)(`已扫描 ${postList.length} 个博文资源，生成 ${postsMetadata.length} 条元数据。`);
    await (0, aliyunOSS_1.default)(files, "", {
        label: "Upload Posts",
        sourcePath: blogPath,
        displayTargetPath: "/articles"
    });
    (0, cliUI_1.printSuccess)(`博文资源上传完成，共 ${files.length} 个对象。`);
}
//  更新博客静态资源至 OSS
async function uploadBlogToOSS(blogAppPath = (0, config_1.getConfigBlogAppPath)()) {
    const files = (0, utils_1.getBlogFileList)(blogAppPath);
    const objList = files.map(post => {
        const filePath = path_1.default.format(post);
        const objName = path_1.default.relative(blogAppPath, filePath).replace(/\\/g, '/');
        return {
            name: objName,
            filePath
        };
    });
    (0, cliUI_1.printInfo)(`已扫描 ${objList.length} 个静态资源文件。`);
    await (0, aliyunOSS_1.default)(objList, "", {
        label: "Upload App Assets",
        sourcePath: blogAppPath,
        displayTargetPath: "/"
    });
    (0, cliUI_1.printSuccess)(`静态资源上传完成，共 ${objList.length} 个对象。`);
}
const helpItems = [
    {
        name: "uo",
        usage: "blog uo [postsDir]",
        description: "上传博文和文章资源到 OSS"
    },
    {
        name: "ao",
        usage: "blog ao [appDir]",
        description: "上传博客静态资源到 OSS"
    },
    {
        name: "config",
        usage: "blog config",
        description: "显示当前解析后的配置"
    },
    {
        name: "help",
        usage: "blog help",
        description: "显示命令帮助"
    }
];
const commandList = {
    uo: async (...args) => uploadPostsToOSS(...args),
    ao: async (...args) => uploadBlogToOSS(...args),
    config: async () => {
        (0, cliUI_1.printConfigSummary)((0, config_1.getConfig)(), (0, config_1.getLoadedEnvPath)());
    },
    help: async () => {
        (0, cliUI_1.printHelp)(helpItems);
    }
};
const HELP_FLAGS = new Set(["-h", "--help"]);
const argv = process.argv.slice(2);
// 第一个参数是命令， 后面跟命令的参数
// 只实现 commandName arg1 arg2 arg3 ... 的形式
const [commandName, ...args] = argv;
async function main() {
    (0, cliUI_1.printBanner)();
    if (!commandName || HELP_FLAGS.has(commandName)) {
        (0, cliUI_1.printHelp)(helpItems);
        return;
    }
    const command = commandList[commandName];
    if (!command) {
        (0, cliUI_1.printError)(`未知命令: ${commandName}`);
        (0, cliUI_1.printHelp)(helpItems);
        process.exitCode = 1;
        return;
    }
    await command(...args);
}
main().catch(error => {
    (0, cliUI_1.printError)(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
