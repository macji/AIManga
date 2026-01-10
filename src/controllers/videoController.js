import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);
const VIDEO_DIR = path.join(process.cwd(), 'assets', 'video');

if (!fs.existsSync(VIDEO_DIR)) {
    fs.mkdirSync(VIDEO_DIR, { recursive: true });
}

// 1. 渲染编辑器页面
export const renderEditor = async (ctx) => {
    let files = [];
    if (fs.existsSync(VIDEO_DIR)) {
        // 过滤出 .mp4 和 bgm.mp3
        files = fs.readdirSync(VIDEO_DIR).filter(f => {
            return (f.endsWith('.mp4') && f !== 'output.mp4' && !f.startsWith('temp_')) || f === 'bgm.mp3';
        });
    }
    await ctx.render('video_editor', { title: '视频编辑器', existingFiles: files });
};

// 2. 上传处理 (支持 视频切片 和 BGM)
export const uploadVideo = async (ctx) => {
    const { index, fileData } = ctx.request.body; // index 0 = BGM, 1-30 = Video

    if (!fileData || index === undefined) {
        ctx.status = 400;
        ctx.body = { success: false, message: "参数缺失" };
        return;
    }

    try {
        // === Case A: 背景音乐 (Index 0) ===
        if (parseInt(index) === 0) {
            const targetPath = path.join(VIDEO_DIR, 'bgm.mp3');
            
            // 保存 MP3 (不裁剪)
            const base64Data = fileData.replace(/^data:audio\/\w+;base64,/, "");
            const dataBuffer = Buffer.from(base64Data, 'base64');
            fs.writeFileSync(targetPath, dataBuffer);

            ctx.body = { 
                success: true, 
                message: "背景音乐上传成功", 
                url: `/video/bgm.mp3`, 
                filename: 'bgm.mp3'
            };
            return;
        }

        // === Case B: 视频片段 (Index 1-30) ===
        const tempFileName = `temp_${index}_${Date.now()}.mp4`;
        const tempPath = path.join(VIDEO_DIR, tempFileName);
        const targetFileName = `${index}.mp4`;
        const targetPath = path.join(VIDEO_DIR, targetFileName);

        // 1. Base64 转文件
        const base64Data = fileData.replace(/^data:video\/\w+;base64,/, "");
        const dataBuffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(tempPath, dataBuffer);

        // 2. FFmpeg 处理 (切掉前0.1s)
        // 强制转为 AAC 音频编码，确保后续 amix 混音时有音轨
        const command = `ffmpeg -y -ss 0.1 -i "${tempPath}" -c:v libx264 -c:a aac "${targetPath}"`;
        
        console.log(`[Video] Processing: ${command}`);
        await execPromise(command);

        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

        ctx.body = { 
            success: true, 
            message: "视频处理成功", 
            url: `/video/${targetFileName}`,
            filename: targetFileName
        };

    } catch (err) {
        console.error("[Upload] Error:", err);
        ctx.status = 500;
        ctx.body = { success: false, message: "处理失败: " + err.message };
    }
};

// 3. 合成视频 (Video Concat + BGM Mix)
export const mergeVideos = async (ctx) => {
    try {
        if (!fs.existsSync(VIDEO_DIR)) throw new Error("目录不存在");
        
        // 1. 获取所有视频片段 (1.mp4 ... 30.mp4)
        const files = fs.readdirSync(VIDEO_DIR).filter(f => /^\d+\.mp4$/.test(f));
        if (files.length === 0) throw new Error("没有可合成的视频片段");

        // 按数字排序
        files.sort((a, b) => parseInt(a) - parseInt(b));

        // 2. 生成 concat 列表
        const listPath = path.join(VIDEO_DIR, 'mylist.txt');
        const listContent = files.map(f => `file '${path.join(VIDEO_DIR, f)}'`).join('\n');
        fs.writeFileSync(listPath, listContent);

        // 路径定义
        const tempCombinedVideo = path.join(VIDEO_DIR, 'temp_combined.mp4');
        const finalOutput = path.join(VIDEO_DIR, 'output.mp4');
        const bgmPath = path.join(VIDEO_DIR, 'bgm.mp3');

        // 3. 第一步：单纯拼接视频 (Concat)
        // -safe 0 允许绝对路径
        const concatCmd = `ffmpeg -y -f concat -safe 0 -i "${listPath}" -c copy "${tempCombinedVideo}"`;
        console.log(`[Merge Step 1] Concat: ${concatCmd}`);
        await execPromise(concatCmd);

        // 4. 第二步：判断是否有 BGM 并合成
        if (fs.existsSync(bgmPath)) {
            console.log(`[Merge Step 2] Mixing BGM...`);
            
            // 混音逻辑:
            // input 0: 视频 (带原声)
            // input 1: BGM
            // [1:a]volume=0.7[bgm]: 将 BGM 音量降为 70%
            // [0:a][bgm]amix: 混合原声和处理后的BGM
            // duration=first: 以视频长度为准 (BGM如果长了会被截断，短了会结束)
            // -c:v copy: 视频画面不重新编码，速度快
            const mixCmd = `ffmpeg -y -i "${tempCombinedVideo}" -i "${bgmPath}" -filter_complex "[1:a]volume=0.7[bgm];[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]" -map 0:v -map "[aout]" -c:v copy -c:a aac "${finalOutput}"`;
            
            await execPromise(mixCmd);
            
            // 清理中间视频
            fs.unlinkSync(tempCombinedVideo);
        } else {
            console.log(`[Merge Step 2] No BGM, renaming...`);
            // 没有 BGM，直接把拼接好的视频改名为 output.mp4
            if (fs.existsSync(finalOutput)) fs.unlinkSync(finalOutput);
            fs.renameSync(tempCombinedVideo, finalOutput);
        }
        
        // 清理 list 文件
        fs.unlinkSync(listPath);

        ctx.body = { success: true, url: `/video/output.mp4` };
    } catch (err) {
        console.error("[Merge] Error:", err);
        ctx.status = 500;
        ctx.body = { success: false, message: err.message };
    }
};

export const deleteVideo = async (ctx) => {
    const { index } = ctx.request.body;
    // index: 0 为 bgm, 1-30 为视频
    if (index === undefined) {
        ctx.status = 400;
        ctx.body = { success: false, message: "参数缺失" };
        return;
    }

    try {
        const fileName = parseInt(index) === 0 ? 'bgm.mp3' : `${index}.mp4`;
        const filePath = path.join(VIDEO_DIR, fileName);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            ctx.body = { success: true, message: "删除成功" };
        } else {
            // 文件本就不存在，也算删除成功
            ctx.body = { success: true, message: "文件不存在或已删除" };
        }
    } catch (err) {
        console.error("[Delete] Error:", err);
        ctx.status = 500;
        ctx.body = { success: false, message: "删除失败: " + err.message };
    }
};

// [新增] 一键清空所有素材
export const clearAllVideos = async (ctx) => {
    try {
        if (fs.existsSync(VIDEO_DIR)) {
            const files = fs.readdirSync(VIDEO_DIR);
            for (const file of files) {
                // 删除所有相关文件 (mp4, mp3, txt列表)
                if (['.mp4', '.mp3', '.txt'].includes(path.extname(file).toLowerCase())) {
                    fs.unlinkSync(path.join(VIDEO_DIR, file));
                }
            }
        }
        ctx.body = { success: true, message: "所有素材已清空" };
    } catch (err) {
        console.error("[ClearAll] Error:", err);
        ctx.status = 500;
        ctx.body = { success: false, message: "清空失败: " + err.message };
    }
};

// [新增] 清理视频：切除前 0.1 秒并覆盖
export const cleanVideo = async (ctx) => {
    const { index } = ctx.request.body;
    // 仅针对视频文件 (1-30)
    if (!index || parseInt(index) === 0) {
        ctx.status = 400;
        ctx.body = { success: false, message: "参数无效" };
        return;
    }

    try {
        const fileName = `${index}.mp4`;
        const filePath = path.join(VIDEO_DIR, fileName);
        
        if (!fs.existsSync(filePath)) {
            ctx.body = { success: false, message: "文件不存在" };
            return;
        }

        // 临时输出路径
        const tempPath = path.join(VIDEO_DIR, `temp_clean_${index}_${Date.now()}.mp4`);

        // 执行剪切: -ss 0.1 跳过前0.1秒
        // 使用 libx264 重编码以保证剪切精确性
        const command = `ffmpeg -y -ss 0.1 -i "${filePath}" -c:v libx264 -c:a aac "${tempPath}"`;
        
        console.log(`[Clean] Processing: ${command}`);
        await execPromise(command);

        // 成功后，删除原文件并将临时文件重命名为原文件名
        if (fs.existsSync(tempPath)) {
            fs.unlinkSync(filePath);
            fs.renameSync(tempPath, filePath);
            
            ctx.body = { 
                success: true, 
                message: "已切除前 0.1 秒",
                // 返回带时间戳的 URL 方便前端刷新缓存
                url: `/video/${fileName}?t=${Date.now()}` 
            };
        } else {
            throw new Error("FFmpeg 处理未生成输出文件");
        }

    } catch (err) {
        console.error("[Clean] Error:", err);
        ctx.status = 500;
        ctx.body = { success: false, message: "操作失败: " + err.message };
    }
};