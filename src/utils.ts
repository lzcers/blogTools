import fs from "fs";
import path from "path";
import fm from "front-matter";

interface PostFrontMatter {
    title: string;
    tags: string;
    publishDate: string;
}

interface PostMetadata {
    fileName: string;
    id: number;
    title: string;
    tags: string;
    publishDate: string;
}

// 拿到所有的文章生成目录
function genPostMetadatalist(postsDir: string) {
    const arrPosts = fs.readdirSync(postsDir).filter(i => !i.match(/(.json|imgs|DS_Store)/));
    return Promise.all(
        arrPosts.map((i, index) => new Promise<PostMetadata>((resolve, reject) => {
            fs.readFile(path.format({ dir: postsDir, base: i }), "utf8", (err, data) => {
                if (err) reject(err);
                const { attributes } = fm<PostFrontMatter>(data);
                resolve({
                    fileName: i,
                    id: index,
                    title: attributes.title,
                    tags: attributes.tags,
                    publishDate: attributes.publishDate,
                });
            });
        }))
    );
}

// 替换博文中的图片链接
function replacePostAssetUrl(postStr: string) {
    return postStr.replace(/\]\(\.?(\\|\/)?imgs(\\|\/)/g, "](/articles/imgs/");
}

function getAllFilesName(rootPath: string) {
    const filesPath: string[] = [];
    const getPathFiles = (p: string) => {
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

// 上传博客静态资源 css, js
function getFileList(rootPath: string) {
    return getAllFilesName(rootPath)
        .filter(file => {
            const extName = path.extname(file);
            // 只上传 css 和 js 文件
            if (extName === ".css" || extName === ".js" || extName === ".wasm" || extName === ".ico" || extName == ".html") return true;
            return false;
        })
        .map(f => path.parse(f));
}

// 上传博文以及引用的资源
function getPostList(rootPath: string) {
    return getAllFilesName(rootPath)
        .filter(file => {
            const typeList = [".png", ".jpg", ".webp", ".jpeg", ".md", ".json", ".ico"];
            const extName = path.extname(file);
            if (typeList.some(name => name === extName)) return true;
            return false;
        })
        .map(f => path.parse(f));
}



export {
    getAllFilesName,
    getFileList,
    getPostList,
    replacePostAssetUrl,
    genPostMetadatalist
}

// console.log(await genPostMetadatalist("D:/docs/blog/"))
