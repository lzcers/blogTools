#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const { uploadOSS } = require('./aliyunOSS.js');
const { genTagslist } = require('./genTagslist.js');

const { blogRootPath, sourcePath, sourceDocPath } = require('./config.js');

const argv = process.argv.slice(2);
// 第一个参数是命令， 后面跟命令的参数
// 只实现 commandName arg1 arg2 arg3 ... 的形式
const [commandName, ...args] = argv;

// save to repository
const cSaveToRepo = () => {
    console.log('----------------------------------------');
    console.log('正在保存文章至远端仓库...');
    try {
        const add = 'git add .',
            commit = `git commit -m "update posts..."`,
            push = 'git push';
        console.log(add);
        execSync(add, { cwd: sourcePath });
        console.log(commit);
        execSync(commit, { cwd: sourcePath });
        console.log(push);
        execSync(push, { cwd: sourcePath });
    } catch (e) {
        console.log('推送失败!' + e.stdout);
    }
};

// 把博文上传至 OSS
const cPublish = () => {
    const push = () =>
        // 生成 tags
        genTagslist(sourceDocPath).then(tagsList => {
            fs.writeFile(
                path.format({
                    dir: sourceDocPath,
                    base: '/tags.json'
                }),
                JSON.stringify(tagsList, null, '  '),
                'utf8',
                err => {
                    if (err) throw err;
                    console.log('tagsList created success...');
                    console.log('----------------------------------------');
                    console.log('正在推送文章...');
                    try {
                        // 上传静态资源
                        uploadOSS(sourceDocPath);
                        const add = 'git add .',
                            commit = 'git commit -m "update posts..."',
                            push = 'git push';
                        //                      execSync(add, { cwd: targetPath });
                        //                      console.log(commit);
                        //                      execSync(commit, { cwd: targetPath });
                        //                      console.log(push);
                        //                      execSync(push, { cwd: targetPath });
                    } catch (e) {
                        console.log('推送失败!' + e.stdout);
                    }
                }
            );
        });
    push();
};

const commandList = {
    s: cSaveToRepo,
    p: cPublish,
    uo: () => uploadOSS(blogRootPath),
    sp: () => (cSaveToRepo(), cPublish())
};

console.log(`
----------------------------------------
            Ksana 博客自用工具
----------------------------------------
    s   := 保存文档至仓库
    p   := 发布博文
    sp  := 保存文档并发布博文
    uo  := 博客静态资源更新至 OSS 
`);

// 执行命令
if (!!commandName) {
    const command = commandList[commandName];
    command && command(args);
}
