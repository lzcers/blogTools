const path = require('path');
const fs = require('fs');
const fm = require('front-matter');

fs.readFile(
    path.resolve('FeHelper-20180512165754.json'),
    'utf8',
    (err, data) => {
        JSON.parse(data).map(p => {
            const { attributes, body } = fm(p.Content);

            fs.writeFile(
                path.format({
                    dir: path.resolve(),
                    base: 'articles/' + p.title + '.md'
                }),
                `---\ntitle: ${attributes.title} \ntags: ${
                    attributes.tags
                } \nPublishDate: ${attributes.publishDate ||
                    p.publishDate} \n---\n${body}
    `,
                'utf8',
                err => {
                    if (err) throw err;
                    console.log('post created success...');
                }
            );
        });
    }
);
