import path from "path";
import type { AppConfig } from "./config";

type Tone = "info" | "success" | "warning" | "error" | "muted";

interface CommandHelpItem {
    name: string;
    usage: string;
    description: string;
}

interface UploadProgressOptions {
    label: string;
    sourcePath: string;
    targetPath: string;
    total: number;
    workerCount: number;
}

interface UploadFailureDetail {
    name: string;
    error: string;
}

interface UploadProgressSummary {
    total: number;
    successful: number;
    failed: number;
    durationMs: number;
    workerCount: number;
    failures: UploadFailureDetail[];
}

interface UploadProgressReporter {
    start(): void;
    onSuccess(name: string): void;
    onFailure(name: string, error: string): void;
    finish(): void;
    abort(error: unknown): void;
}

const ANSI = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
    gray: "\x1b[90m"
};

function supportsAnsi(): boolean {
    return Boolean(process.stdout.isTTY) && process.env.NO_COLOR === undefined;
}

function colorize(text: string, ...codes: string[]): string {
    if (!supportsAnsi()) {
        return text;
    }

    return `${codes.join("")}${text}${ANSI.reset}`;
}

function toneColor(tone: Tone): string {
    switch (tone) {
        case "success":
            return ANSI.green;
        case "warning":
            return ANSI.yellow;
        case "error":
            return ANSI.red;
        case "muted":
            return ANSI.gray;
        case "info":
        default:
            return ANSI.cyan;
    }
}

function badge(label: string, tone: Tone = "info"): string {
    return colorize(`[${label}]`, ANSI.bold, toneColor(tone));
}

function dim(text: string): string {
    return colorize(text, ANSI.dim);
}

function heading(text: string): string {
    return colorize(text, ANSI.bold, ANSI.cyan);
}

function divider(char = "="): string {
    const width = Math.min(process.stdout.columns ?? 72, 72);
    return char.repeat(width);
}

function keyValue(label: string, value: string): string {
    return `${dim(label.padEnd(12, " "))} ${value}`;
}

function formatDuration(durationMs: number): string {
    if (durationMs < 1000) {
        return `${durationMs}ms`;
    }

    const totalSeconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes === 0) {
        return `${seconds}s`;
    }

    return `${minutes}m ${seconds}s`;
}

function maskSecret(secret: string): string {
    if (!secret || secret.length < 8) {
        return "****";
    }

    return `${secret.slice(0, 4)}****${secret.slice(-4)}`;
}

function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
        return text;
    }

    if (maxLength <= 3) {
        return text.slice(0, maxLength);
    }

    return `${text.slice(0, maxLength - 3)}...`;
}

function compactError(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
}

export function printBanner(): void {
    console.log(heading(divider()));
    console.log(`${heading("Blog Tools")} ${dim("OSS uploader for posts and static assets")}`);
    console.log(dim("Commands: uo | ao | config | help"));
    console.log(heading(divider()));
}

export function printHelp(commands: CommandHelpItem[]): void {
    console.log();
    console.log(heading("Usage"));
    console.log("  blog <command> [path]");

    console.log();
    console.log(heading("Commands"));
    commands.forEach(command => {
        console.log(`  ${colorize(command.name.padEnd(8, " "), ANSI.bold, ANSI.blue)} ${command.description}`);
        console.log(`  ${dim(command.usage)}`);
    });

    console.log();
    console.log(heading("Config"));
    console.log("  Put a .env file in the current directory or your home directory.");
    console.log("  Required keys are listed in .env.example.");
}

export function printInfo(message: string): void {
    console.log(`${badge("INFO")} ${message}`);
}

export function printSuccess(message: string): void {
    console.log(`${badge("DONE", "success")} ${message}`);
}

export function printWarning(message: string): void {
    console.log(`${badge("WARN", "warning")} ${message}`);
}

export function printError(message: string): void {
    console.error(`${badge("ERROR", "error")} ${message}`);
}

export function printConfigSummary(config: AppConfig, envPath: string | null): void {
    console.log();
    console.log(heading("Resolved Config"));
    console.log(keyValue("Env File", envPath ?? "(not found)"));
    console.log(keyValue("OSS Region", config.oss.region));
    console.log(keyValue("OSS Bucket", config.oss.bucket));
    console.log(keyValue("Access Key", maskSecret(config.oss.accessKeyId)));
    console.log(keyValue("Secret Key", maskSecret(config.oss.accessKeySecret)));
    console.log(keyValue("Posts Dir", config.postsDir));
    console.log(keyValue("App Dir", config.appDir));
}

class UploadProgressBar implements UploadProgressReporter {
    private readonly startedAt = Date.now();
    private readonly interactive = Boolean(process.stdout.isTTY);
    private readonly failures: UploadFailureDetail[] = [];
    private completed = 0;
    private successful = 0;
    private failed = 0;
    private lastName = "";
    private lastStaticRenderCompleted = -1;
    private lastStaticRenderFailed = -1;

    constructor(private readonly options: UploadProgressOptions) { }

    start(): void {
        console.log();
        console.log(`${badge("UPLOAD")} ${this.options.label}`);
        console.log(keyValue("Source", this.options.sourcePath));
        console.log(keyValue("Target", this.options.targetPath));
        console.log(keyValue("Files", String(this.options.total)));
        console.log(keyValue("Threads", String(this.options.workerCount)));

        if (this.options.total === 0) {
            printWarning("没有发现可上传的文件。");
            return;
        }

        this.render();
    }

    onSuccess(name: string): void {
        this.completed++;
        this.successful++;
        this.lastName = name;
        this.render();
    }

    onFailure(name: string, error: string): void {
        this.completed++;
        this.failed++;
        this.lastName = name;
        this.failures.push({ name, error });

        if (this.interactive) {
            this.clearLine();
            console.error(`${badge("FAIL", "error")} ${name}`);
            console.error(dim(truncate(error.split("\n")[0] || error, 120)));
        }
        this.render();
    }

    finish(): void {
        if (this.options.total > 0 && this.interactive) {
            this.writeLine(this.progressLine());
            process.stdout.write("\n");
        }

        const summary: UploadProgressSummary = {
            total: this.options.total,
            successful: this.successful,
            failed: this.failed,
            durationMs: Date.now() - this.startedAt,
            workerCount: this.options.workerCount,
            failures: this.failures
        };

        const summaryTone: Tone = summary.failed > 0 ? "warning" : "success";
        const summaryLabel = summary.failed > 0 ? "PARTIAL" : "COMPLETE";

        console.log(`${badge(summaryLabel, summaryTone)} ${this.options.label}`);
        console.log(keyValue("Uploaded", `${summary.successful}/${summary.total}`));
        console.log(keyValue("Failed", String(summary.failed)));
        console.log(keyValue("Elapsed", formatDuration(summary.durationMs)));
        console.log(keyValue("Threads", String(summary.workerCount)));

        if (summary.failures.length > 0) {
            console.log();
            console.log(heading("Failed Files"));
            summary.failures.forEach(item => {
                console.log(`  ${badge("FAIL", "error")} ${item.name}`);
                console.log(`  ${dim(truncate(item.error.split("\n")[0] || item.error, 140))}`);
            });
        }
    }

    abort(error: unknown): void {
        if (this.options.total > 0 && this.interactive) {
            this.clearLine();
        }

        console.error(`${badge("ABORT", "error")} ${this.options.label}`);
        console.error(dim(compactError(error)));
    }

    private render(): void {
        if (this.options.total === 0) {
            return;
        }

        const line = this.progressLine();

        if (this.interactive) {
            this.writeLine(line);
            return;
        }

        const step = Math.max(1, Math.ceil(this.options.total / 20));
        const shouldRender =
            this.completed === this.options.total ||
            this.failed !== this.lastStaticRenderFailed ||
            this.completed - this.lastStaticRenderCompleted >= step;

        if (shouldRender) {
            console.log(line);
            this.lastStaticRenderCompleted = this.completed;
            this.lastStaticRenderFailed = this.failed;
        }
    }

    private progressLine(): string {
        const ratio = this.options.total === 0 ? 1 : this.completed / this.options.total;
        const percent = Math.round(ratio * 100);
        const barWidth = this.resolveBarWidth();
        const filledWidth = Math.round(ratio * barWidth);
        const bar = `[${"=".repeat(filledWidth)}${"-".repeat(barWidth - filledWidth)}]`;
        const currentFile = this.lastName
            ? ` ${dim(truncate(path.basename(this.lastName), 24))}`
            : "";

        return `${badge("PROGRESS")} ${bar} ${String(percent).padStart(3, " ")}% `
            + `${this.completed}/${this.options.total} ok:${this.successful} fail:${this.failed}`
            + ` ${dim(formatDuration(Date.now() - this.startedAt))}${currentFile}`;
    }

    private resolveBarWidth(): number {
        if (!this.interactive) {
            return 24;
        }

        const columns = process.stdout.columns ?? 100;
        return Math.max(12, Math.min(30, columns - 56));
    }

    private clearLine(): void {
        process.stdout.write("\x1b[2K\r");
    }

    private writeLine(line: string): void {
        process.stdout.write(`\x1b[2K\r${line}`);
    }
}

export function createUploadProgress(options: UploadProgressOptions): UploadProgressReporter {
    return new UploadProgressBar(options);
}

export type {
    CommandHelpItem,
    UploadProgressOptions,
    UploadProgressReporter
};
