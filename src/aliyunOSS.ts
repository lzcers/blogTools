import OSS from 'ali-oss';
import { ossConfig } from './config';

const client = new OSS(ossConfig);

interface OssObject {
    name: string;
    data: Buffer;
}
export default async function uploadOSS(objList: OssObject[], targetPath = "") {
    try {
        console.log(`开始上传静态资源至 OSS,总共${objList.length}个文件.`);
        let remainCount = objList.length;
        await Promise.all(
            objList.map(async obj => {
                try {
                    await client.put(targetPath + obj.name, obj.data);
                    remainCount--;
                    console.log(`[${obj.name}] 上传成功,剩余:${remainCount}`);
                } catch (e) {
                    console.error("上传失败:" + obj.name);
                    console.error(e);
                }
            })
        )
        console.log("静态资源上传至 OSS 成功!");
    } catch (e) {
        console.error("静态资源上传至 OSS 失败!");
        console.error(e);
    }
}
