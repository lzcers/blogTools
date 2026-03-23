#!/usr/bin/env node
import uploadOSS from './aliyunOSS';
import {
    getConfig,
    getConfigBlogAppPath,
    getConfigBlogPath,
    getLoadedEnvPath
} from './config';
import {
    printBanner,
    printConfigSummary,
    printError,
    printHelp,
    printInfo,
    printSuccess,
    type CommandHelpItem
} from './cliUI';
import { genPostMetadatalist, getPostList, getBlogFileList } from './utils';
import type { UploadObject } from './uploadTypes';
import path from 'path';

//  更新博文至 OSS
async function uploadPostsToOSS(blogPath: string = getConfigBlogPath()) {
    const postsMetadata = await genPostMetadatalist(blogPath);
    const postList = getPostList(blogPath);
    const files: UploadObject[] = postList.map(post => {
        const filePath = path.format(post);
        const objName = path.relative(blogPath, filePath).replace(/\\/g, '/');

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

    printInfo(`已扫描 ${postList.length} 个博文资源，生成 ${postsMetadata.length} 条元数据。`);
    await uploadOSS(files, "", {
        label: "Upload Posts",
        sourcePath: blogPath,
        displayTargetPath: "/articles"
    });
    printSuccess(`博文资源上传完成，共 ${files.length} 个对象。`);
}
//  更新博客静态资源至 OSS
async function uploadBlogToOSS(blogAppPath: string = getConfigBlogAppPath()) {
    const files = getBlogFileList(blogAppPath);
    const objList: UploadObject[] = files.map(post => {
        const filePath = path.format(post);
        const objName = path.relative(blogAppPath, filePath).replace(/\\/g, '/');

        return {
            name: objName,
            filePath
        };
    });

    printInfo(`已扫描 ${objList.length} 个静态资源文件。`);
    await uploadOSS(objList, "", {
        label: "Upload App Assets",
        sourcePath: blogAppPath,
        displayTargetPath: "/"
    });
    printSuccess(`静态资源上传完成，共 ${objList.length} 个对象。`);
}

const helpItems: CommandHelpItem[] = [
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
    uo: async (...args: string[]) => uploadPostsToOSS(...args),
    ao: async (...args: string[]) => uploadBlogToOSS(...args),
    config: async () => {
        printConfigSummary(getConfig(), getLoadedEnvPath());
    },
    help: async () => {
        printHelp(helpItems);
    }
};

type CommandName = keyof typeof commandList;
const HELP_FLAGS = new Set(["-h", "--help"]);

const argv = process.argv.slice(2);
// 第一个参数是命令， 后面跟命令的参数
// 只实现 commandName arg1 arg2 arg3 ... 的形式
const [commandName, ...args] = argv;

async function main() {
    printBanner();

    if (!commandName || HELP_FLAGS.has(commandName)) {
        printHelp(helpItems);
        return;
    }

    const command = commandList[commandName as CommandName];
    if (!command) {
        printError(`未知命令: ${commandName}`);
        printHelp(helpItems);
        process.exitCode = 1;
        return;
    }

    await command(...args);
}

main().catch(error => {
    printError(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
