"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllFilesName = getAllFilesName;
exports.getBlogFileList = getBlogFileList;
exports.getPostList = getPostList;
exports.replacePostAssetUrl = replacePostAssetUrl;
exports.genPostMetadatalist = genPostMetadatalist;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const front_matter_1 = __importDefault(require("front-matter"));
// 拿到所有的文章生成目录
function genPostMetadatalist(postsDir) {
    const arrPosts = fs_1.default.readdirSync(postsDir, { withFileTypes: true })
        .filter((dirent) => dirent.isFile() && !dirent.name.match(/(.json|DS_Store)/))
        .map((dirent) => dirent.name);
    return Promise.all(arrPosts.map((i, index) => new Promise((resolve, reject) => {
        const filePath = path_1.default.format({ dir: postsDir, base: i });
        fs_1.default.readFile(filePath, "utf8", (err, data) => {
            if (err) {
                reject(err);
                return;
            }
            const { attributes } = (0, front_matter_1.default)(data);
            resolve({
                fileName: i,
                id: index,
                title: attributes.title,
                tags: attributes.tags,
                publishDate: attributes.publishDate,
            });
        });
    })));
}
// 替换博文中的图片链接
function replacePostAssetUrl(postStr) {
    return postStr.replace(/!\[([^\]]*)\]\((?!http|https|\/)(.*?)\)/g, (match, altText, url) => {
        const imageName = url.trim().split(/\\|\//).pop()?.trim();
        if (imageName) {
            return `![${altText}](articles/imgs/${imageName})`;
        }
        return match;
    });
}
function getAllFilesName(rootPath) {
    const filesPath = [];
    const getPathFiles = (p) => {
        // 判断是否存在，判断是否是目录或是文件
        if (!fs_1.default.existsSync(p)) {
            return;
        }
        const files = fs_1.default.readdirSync(p, { withFileTypes: true });
        files.forEach((file) => {
            if (file.isFile())
                filesPath.push(path_1.default.join(p, file.name));
            if (file.isDirectory())
                getPathFiles(path_1.default.join(p, file.name));
        });
    };
    getPathFiles(rootPath);
    return filesPath;
}
;
// 上传博客静态资源 css, js
function getBlogFileList(rootPath) {
    return getAllFilesName(rootPath)
        .filter(file => {
        const extName = path_1.default.extname(file);
        // 只上传 css 和 js 文件
        const typeList = [".css", ".js", ".wasm", ".ico", ".html", ".jpg", ",png", ".webp", ".ico"];
        if (typeList.some(name => name === extName))
            return true;
        return false;
    })
        .map(f => path_1.default.parse(f));
}
// 上传博文以及引用的资源
function getPostList(rootPath) {
    return getAllFilesName(rootPath)
        .filter(file => {
        const typeList = [".png", ".jpg", ".webp", ".jpeg", ".md", ".json", ".ico"];
        const extName = path_1.default.extname(file);
        if (typeList.some(name => name === extName))
            return true;
        return false;
    })
        .map(f => path_1.default.parse(f));
}
// console.log(await genPostMetadatalist("D:/docs/blog/"))
