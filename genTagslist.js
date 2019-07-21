const fs = require('fs');
const path = require('path');
const fm = require('front-matter');

const genTagslist = postsDir => {
    // 拿到所有的文章
    const arrPosts = fs
        .readdirSync(postsDir)
        .filter(i => !i.match(/(.json|imgs)/))
        .reverse();

    return Promise.all(
        arrPosts.map(
            (i, index) =>
                new Promise((resolve, reject) => {
                    fs.readFile(
                        path.format({ dir: postsDir, base: i }),
                        'utf8',
                        (err, data) => {
                            if (err) reject(err);
                            const { attributes, body } = fm(data);
                            // 替换博文中的图片链接
                            fs.writeFileSync(
                                path.format({ dir: postsDir, base: i }),
                                data.replace(
                                    /\]\(\.?(\\|\/)?imgs(\\|\/)/g,
                                    '](https://ksana.oss-cn-shenzhen.aliyuncs.com/articles/imgs/'
                                ),
                                'utf8'
                            );
                            resolve({
                                fileName: i,
                                ID: index,
                                ...attributes,
                                Content:
                                    body
                                        .replace(
                                            /\]\(\.?(\\|\/)?imgs(\\|\/)/g,
                                            '](https://ksana.oss-cn-shenzhen.aliyuncs.com/articles/imgs/'
                                        )
                                        .split(/(。)/g, 10)
                                        .join('') + '<strong>……</strong>'
                            });
                        }
                    );
                })
        )
    );
};

module.exports = {
    genTagslist
};
