const OSS = require("ali-oss");
const path = require("path");
const fs = require("fs");
const { oss, relayOss } = require("./config");
let client = new OSS(oss);
let relayClient = new OSS(relayOss);

const getAllFilesName = rootPath => {
    const filesPath = [];
    const getPathFiles = p => {
        // 判断是否存在，判断是否是目录或是文件
        if (!fs.existsSync(p)) return [];
        const files = fs.readdirSync(p, { withFileTypes: true });
        files.forEach(file => {
            if (file.isFile()) filesPath.push(path.join(p, file.name));
            if (file.isDirectory()) getPathFiles(path.join(p, file.name));
        });
    };
    getPathFiles(rootPath);
    return filesPath;
};

// 上传 css, js
const getUploadFiles = rootPath =>
    getAllFilesName(rootPath)
        .filter(file => {
            const extName = path.extname(file);
            // 只上传 css 和 js 文件
            if (extName === ".css" || extName === ".js" || extName === ".wasm" || extName === ".ico" || extName == ".html") return true;
            return false;
        })
        .map(f => path.parse(f));

// 上传 md 文档
const getUploadPosts = rootPath =>
    getAllFilesName(rootPath)
        .filter(file => {
            const typeList = [".png", ".jpg", ".webp", ".jpeg", ".md", ".json", ".ico"];
            const extName = path.extname(file);
            if (typeList.some(name => name === extName)) return true;
            return false;
        })
        .map(f => path.parse(f));

function uploadOSS(client, rootPath, files, targetPath = "") {
    try {
        files.forEach(f => {
            // 取文件相对根目录的路径
            let objName = path.relative(rootPath, path.join(f.dir, f.base)).replace(/\\/g, "/");
            client.put(targetPath + objName, path.format({ dir: f.dir, base: f.base }));
        });
        console.log("静态资源上传至 OSS 成功！");
    } catch (e) {
        console.error("静态资源上传至 OSS 失败！");
        console.error(e);
    }
}

module.exports = {
    uploadOSS: rootPath => uploadOSS(client, rootPath, getUploadFiles(rootPath)),
    uploadPosts: rootPath => uploadOSS(client, rootPath, getUploadPosts(rootPath), "articles/"),
    uploadRelay: rootPath => uploadOSS(relayClient, rootPath, getUploadFiles(rootPath)),
    aliOSS: client,
};
