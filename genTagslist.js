const fs = require("fs");
const path = require("path");
const fm = require("front-matter");

const genTagslist = postsDir => {
    // 拿到所有的文章
    const arrPosts = fs
        .readdirSync(postsDir)
        .filter(i => !i.match(/(.json|imgs|DS_Store)/))
        .reverse();

    return Promise.all(
        arrPosts.map(
            (i, index) =>
                new Promise((resolve, reject) => {
                    fs.readFile(path.format({ dir: postsDir, base: i }), "utf8", (err, data) => {
                        if (err) reject(err);
                        const { attributes, body } = fm(data);
                        // 替换博文中的图片链接
                        fs.writeFileSync(path.format({ dir: postsDir, base: i }), data.replace(/\]\(\.?(\\|\/)?imgs(\\|\/)/g, "](https://oss.ksana.net/articles/imgs/"), "utf8");
                        resolve({
                            file_name: i,
                            id: index,
                            title: attributes.title,
                            tags: attributes.tags,
                            publish_date: attributes.publishDate,
                        });
                    });
                })
        )
    );
};

module.exports = {
    genTagslist,
};
