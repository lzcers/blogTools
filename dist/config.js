"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = getConfig;
exports.getOssConfig = getOssConfig;
exports.getConfigBlogPath = getConfigBlogPath;
exports.getConfigBlogAppPath = getConfigBlogAppPath;
exports.getLoadedEnvPath = getLoadedEnvPath;
exports.showConfig = showConfig;
exports.loadConfig = loadConfig;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const ENV_FILE_NAME = ".env";
let envLoaded = false;
let loadedEnvPath = null;
let cachedConfig = null;
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
    // 优先从脚本所在包目录查找，避免从任意 cwd 执行 CLI 时丢失配置。
    const envSearchDirs = [
        path_1.default.resolve(__dirname, ".."),
        __dirname,
        process.cwd(),
        os_1.default.homedir()
    ];
    for (const dir of envSearchDirs) {
        const envPath = path_1.default.join(dir, ENV_FILE_NAME);
        if (fs_1.default.existsSync(envPath)) {
            return envPath;
        }
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
    if (envLoaded) {
        return;
    }
    envLoaded = true;
    loadedEnvPath = findEnvFile();
    if (!loadedEnvPath) {
        return;
    }
    try {
        const content = fs_1.default.readFileSync(loadedEnvPath, "utf-8");
        const envMap = parseEnvFile(content);
        console.log(`使用环境变量文件: ${loadedEnvPath}`);
        Object.entries(envMap).forEach(([key, value]) => {
            if (process.env[key] === undefined) {
                process.env[key] = value;
            }
        });
    }
    catch (e) {
        console.error(`.env 文件解析失败: ${loadedEnvPath}`);
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
    if (cachedConfig) {
        return cachedConfig;
    }
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
    cachedConfig = config;
    return cachedConfig;
}
function getConfig() {
    return loadConfig();
}
function getOssConfig() {
    return loadConfig().oss;
}
function getConfigBlogPath() {
    return loadConfig().postsDir;
}
function getConfigBlogAppPath() {
    return loadConfig().appDir;
}
function getLoadedEnvPath() {
    loadEnvFile();
    return loadedEnvPath;
}
/**
 * 显示当前配置（隐藏敏感信息）
 */
function showConfig() {
    const config = loadConfig();
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
