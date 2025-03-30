#!/usr/bin/env node
import fs from 'fs';
import uploadOSS from './aliyunOSS';
import { configBlogPath, configBlogAppPath } from './config';
import { genPostMetadatalist, replacePostAssetUrl, getPostList, getBlogFileList } from './utils';
import path from 'path';

//  更新博文至 OSS
async function uploadPostsToOSS(blogPath: string = configBlogPath) {
    const postsMetadata = await genPostMetadatalist(blogPath);
    const postList = getPostList(blogPath);
    try {
        const files = [];
        for (const post of postList) {
            const filePath = path.format(post);
            const objName = path.relative(blogPath, filePath).replace(/\\/g, '/');
            if (post.ext === '.md') {
                const content = fs.readFileSync(filePath, 'utf-8');
                const processedContent = replacePostAssetUrl(content);
                files.push({
                    name: '/articles/' + objName,
                    data: Buffer.from(processedContent)
                });
            } else {
                const data = fs.readFileSync(filePath);
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
        await uploadOSS(files);
    } catch (e) {
        console.error("上传博文失败！", e);
    }
}
//  更新博客静态资源至 OSS
async function uploadBlogToOSS(blogAppPath: string = configBlogAppPath) {
    const files = getBlogFileList(blogAppPath);
    try {
        const objList = [];
        for (const post of files) {
            const filePath = path.format(post);
            const objName = path.relative(blogAppPath, filePath).replace(/\\/g, '/');
            const data = fs.readFileSync(filePath);
            objList.push({
                name: objName,
                data
            });
        }
        await uploadOSS(objList);
    } catch (e) {
        console.error("上传博文失败！", e);
    }
}

console.log(`
    ----------------------------------------
                Ksana 博客自用工具
    ----------------------------------------
        uo    := 上传博文至 OSS
        ao    := 上传博客至 OSS
`);

const commandList = {
    uo: (...args: string[]) => uploadPostsToOSS(...args),
    ao: (...args: string[]) => uploadBlogToOSS(...args)
};


type CommandName = "uo";

const argv = process.argv.slice(2);
// 第一个参数是命令， 后面跟命令的参数
// 只实现 commandName arg1 arg2 arg3 ... 的形式
const [commandName, ...args] = argv;

if (!!commandName) {
    const command = commandList[commandName as CommandName];
    command && command(...args);
}