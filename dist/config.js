"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configBlogAppPath = exports.configBlogPath = exports.ossConfig = exports.config = void 0;
exports.showConfig = showConfig;
exports.loadConfig = loadConfig;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const ENV_FILE_NAME = ".env";
// 环境变量映射
const ENV_MAPPING = {
    region: "BLOG_OSS_REGION",
    accessKeyId: "BLOG_OSS_ACCESS_KEY_ID",
    accessKeySecret: "BLOG_OSS_ACCESS_KEY_SECRET",
    bucket: "BLOG_OSS_BUCKET",
    postsDir: "BLOG_POSTS_DIR",
    appDir: "BLOG_APP_DIR"
};
// 默认值
const DEFAULTS = {
    region: "oss-rg-china-mainland",
    bucket: "ksana-blog"
};
/**
 * 查找 .env 文件
 */
function findEnvFile() {
    const cwdEnvPath = path_1.default.join(process.cwd(), ENV_FILE_NAME);
    if (fs_1.default.existsSync(cwdEnvPath)) {
        return cwdEnvPath;
    }
    const homeEnvPath = path_1.default.join(os_1.default.homedir(), ENV_FILE_NAME);
    if (fs_1.default.existsSync(homeEnvPath)) {
        return homeEnvPath;
    }
    return null;
}
/**
 * 解析 .env 文件内容
 */
function parseEnvFile(content) {
    const envMap = {};
    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) {
            continue;
        }
        const normalizedLine = line.startsWith("export ")
            ? line.slice("export ".length).trim()
            : line;
        const separatorIndex = normalizedLine.indexOf("=");
        if (separatorIndex <= 0) {
            continue;
        }
        const key = normalizedLine.slice(0, separatorIndex).trim();
        if (!key.match(/^[A-Za-z_][A-Za-z0-9_]*$/)) {
            continue;
        }
        let value = normalizedLine.slice(separatorIndex + 1).trim();
        if ((value.startsWith("\"") && value.endsWith("\"")) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        envMap[key] = value;
    }
    return envMap;
}
/**
 * 从 .env 文件加载环境变量
 */
function loadEnvFile() {
    const envPath = findEnvFile();
    if (!envPath) {
        return;
    }
    try {
        const content = fs_1.default.readFileSync(envPath, "utf-8");
        const envMap = parseEnvFile(content);
        console.log(`使用环境变量文件: ${envPath}`);
        Object.entries(envMap).forEach(([key, value]) => {
            if (process.env[key] === undefined) {
                process.env[key] = value;
            }
        });
    }
    catch (e) {
        console.error(`.env 文件解析失败: ${envPath}`);
        console.error(e);
        process.exit(1);
    }
}
/**
 * 从环境变量获取配置值
 */
function getEnvValue(key) {
    return process.env[key];
}
/**
 * 验证必要配置是否存在
 */
function validateConfig(config) {
    const errors = [];
    if (!config.oss.accessKeyId) {
        errors.push("缺少 OSS Access Key ID");
    }
    if (!config.oss.accessKeySecret) {
        errors.push("缺少 OSS Access Key Secret");
    }
    if (!config.postsDir) {
        errors.push("缺少博文目录配置 (postsDir)");
    }
    if (!config.appDir) {
        errors.push("缺少应用目录配置 (appDir)");
    }
    return errors;
}
/**
 * 加载配置（优先级：进程环境变量 > .env 文件 > 默认值）
 */
function loadConfig() {
    loadEnvFile();
    const config = {
        oss: {
            region: getEnvValue(ENV_MAPPING.region) ||
                DEFAULTS.region,
            accessKeyId: getEnvValue(ENV_MAPPING.accessKeyId) || "",
            accessKeySecret: getEnvValue(ENV_MAPPING.accessKeySecret) || "",
            bucket: getEnvValue(ENV_MAPPING.bucket) ||
                DEFAULTS.bucket
        },
        postsDir: getEnvValue(ENV_MAPPING.postsDir) || "",
        appDir: getEnvValue(ENV_MAPPING.appDir) || ""
    };
    const errors = validateConfig(config);
    if (errors.length > 0) {
        console.error("\n配置错误:");
        errors.forEach(e => console.error(`  - ${e}`));
        console.error("\n请通过以下方式配置:");
        console.error("  1. 在当前目录或用户主目录创建 .env 文件");
        console.error("  2. 写入 BLOG_OSS_ACCESS_KEY_ID 等环境变量");
        process.exit(1);
    }
    return config;
}
// 导出配置实例
const config = loadConfig();
exports.config = config;
// 导出兼容旧代码的格式
const ossConfig = config.oss;
exports.ossConfig = ossConfig;
const configBlogPath = config.postsDir;
exports.configBlogPath = configBlogPath;
const configBlogAppPath = config.appDir;
exports.configBlogAppPath = configBlogAppPath;
/**
 * 显示当前配置（隐藏敏感信息）
 */
function showConfig() {
    console.log("\n当前配置:");
    console.log(`  OSS Region: ${config.oss.region}`);
    console.log(`  OSS Bucket: ${config.oss.bucket}`);
    console.log(`  OSS Access Key ID: ${maskSecret(config.oss.accessKeyId)}`);
    console.log(`  OSS Access Key Secret: ${maskSecret(config.oss.accessKeySecret)}`);
    console.log(`  博文目录: ${config.postsDir}`);
    console.log(`  应用目录: ${config.appDir}`);
}
/**
 * 隐藏敏感信息
 */
function maskSecret(secret) {
    if (!secret || secret.length < 8) {
        return "****";
    }
    return secret.substring(0, 4) + "****" + secret.substring(secret.length - 4);
}
