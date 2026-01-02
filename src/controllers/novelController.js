import Novel from '../models/Novel.js';
import Chapter from '../models/Chapter.js';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import axios from 'axios';

// 1. 渲染小说列表页
export const renderNovelList = async (ctx) => {
    const novels = await Novel.find().sort({ createdAt: -1 });
    await ctx.render('novel_list', { 
        title: '我的作品库', 
        novels: novels,
        breadcrumbs: [
            { label: '作品库', href: null }
        ]
    });
};

// 2. 创建新小说
export const createNovel = async (ctx) => {
    const { title, description } = ctx.request.body;
    await Novel.create({ title, description });
    ctx.redirect('/');
};

// 3. 渲染小说详情
export const renderNovelDetail = async (ctx) => {
    const { id } = ctx.params;
    const novel = await Novel.findById(id);
    const chapters = await Chapter.find({ novelId: id }).sort({ order: 1 });
    
    await ctx.render('novel_detail', { 
        title: novel.title, 
        novel, 
        chapters,
        breadcrumbs: [
            { label: '作品库', href: '/' },
            { label: novel.title, href: null }
        ]
    });
};

// 4. 更新小说信息 (支持局部更新)
export const updateNovel = async (ctx) => {
    const { id } = ctx.params;
    const body = ctx.request.body;
    
    const updateData = {};

    if (body.title !== undefined) updateData.title = body.title;
    if (body.author !== undefined) updateData.author = body.author;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.cover !== undefined) updateData.cover = body.cover;
    
    if (body.prompts) {
        updateData.prompts = body.prompts;
    }

    await Novel.findByIdAndUpdate(id, updateData);
    ctx.redirect(`/novel/${id}`);
};

// 5. 添加章节
export const createChapter = async (ctx) => {
    let { novelId, title, content, order } = ctx.request.body;
    if (!order) {
        const count = await Chapter.countDocuments({ novelId });
        order = count + 1;
    }
    await Chapter.create({ novelId, title, content, order: parseInt(order) });
    ctx.redirect(`/novel/${novelId}`);
};

// 6. 更新章节
export const updateChapter = async (ctx) => {
    const { id } = ctx.params;
    const { title, content, order, novelId } = ctx.request.body;
    await Chapter.findByIdAndUpdate(id, { title, content, order: parseInt(order) });
    ctx.redirect(`/novel/${novelId}`);
};

// 7. 删除章节
export const deleteChapter = async (ctx) => {
    const { id } = ctx.params;
    const chapter = await Chapter.findById(id);
    if (chapter) {
        await Chapter.findByIdAndDelete(id);
        ctx.redirect(`/novel/${chapter.novelId}`);
    } else {
        ctx.redirect('/');
    }
};

// 8. 渲染章节详情页
export const renderChapterDetail = async (ctx) => {
    const { id } = ctx.params;
    const chapter = await Chapter.findById(id);
    const novel = await Novel.findById(chapter.novelId);
    
    await ctx.render('chapter_detail', { 
        title: `${chapter.title} - ${novel.title}`, 
        chapter, 
        novel,
        breadcrumbs: [
            { label: '作品库', href: '/' },
            { label: novel.title, href: `/novel/${novel._id}` },
            { label: chapter.title, href: null }
        ]
    });
};

// 9. 导入脚本
export const importScript = async (ctx) => {
    const { id } = ctx.params;
    const { rawScript } = ctx.request.body;

    let jsonStr = "";
    try {
        const match = rawScript.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        if (match) {
            jsonStr = match[0];
        } else {
            throw new Error("无法找到 JSON 对象");
        }
    } catch (e) {
        ctx.status = 400;
        ctx.body = { success: false, message: "JSON 格式提取失败" };
        return;
    }

    let parsedData;
    try {
        parsedData = JSON.parse(jsonStr);
    } catch (e) {
        ctx.status = 400;
        ctx.body = { success: false, message: "JSON 解析错误: " + e.message };
        return;
    }

    let flatPanels = [];
    try {
        const pages = parsedData.pages || (Array.isArray(parsedData) ? parsedData : []);

        if (pages.length > 0) {
            pages.forEach((page, pIndex) => {
                const pageNum = page.page_number || (pIndex + 1);
                
                let displayContent = `**P${pageNum}**\n\n`;
                
                if (page.panels && Array.isArray(page.panels)) {
                    page.panels.forEach(p => {
                        const panelId = p.panel_id || "?";
                        displayContent += `**Panel ${panelId}**\n`;
                        displayContent += `* **景别：** ${p.shot_type || '未指定'}\n`;
                        displayContent += `* **画面：** ${p.visual_description || '-'}\n`;
                        
                        if (p.environment_details) {
                            displayContent += `* **环境细节：** ${p.environment_details}\n`;
                        }

                        const audio = p.audio_elements || p.lines || [];
                        audio.forEach(a => {
                            const role = a.speaker || "声音";
                            const text = a.text || "";
                            displayContent += `* **${role}：** ${text}\n`;
                        });

                        displayContent += `\n`; 
                    });
                } 
                else {
                    displayContent += `**Panel 1**\n`;
                    displayContent += `* **画面：** ${page.visual_description || page.visual || '-'}\n`;
                }

                flatPanels.push({
                    id: String(pageNum),
                    visual: displayContent,         
                    env: "", 
                    composition: "Whole Page",
                    lines: [], 
                    image_index: pIndex // 暂存
                });
            });
        }
    } catch (err) {
        ctx.status = 500;
        ctx.body = { success: false, message: "数据结构映射出错: " + err.message };
        return;
    }

    flatPanels = flatPanels.map((panel, index) => ({
        ...panel,
        image_index: index + 1 
    }));

    const chapter = await Chapter.findById(id);
    const novelIdStr = chapter.novelId.toString();
    const epFolder = `ep${chapter.order}`; 
    const targetDir = path.join(process.cwd(), 'assets', 'outputs', 'images', novelIdStr, epFolder);
    
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    try {
        const updatedChapter = await Chapter.findByIdAndUpdate(id, {
            script_data: flatPanels
        }, { new: true }); 

        ctx.body = { 
            success: true, 
            message: `成功解析 ${flatPanels.length} 页脚本`,
            data: updatedChapter.script_data 
        };

    } catch (dbErr) {
        ctx.status = 500;
        ctx.body = { success: false, message: "数据库保存失败" };
    }
};

// 10. 获取单卡片 Prompt
export const getPanelPrompt = async (ctx) => {
    const { id, panelId } = ctx.params; 
    const chapter = await Chapter.findById(id);
    const novel = await Novel.findById(chapter.novelId);

    const panel = chapter.script_data.find(p => p.id === panelId);

    if (!panel) {
        ctx.status = 404;
        ctx.body = { success: false, error: "Panel not found" };
        return;
    }

    const cardContent = panel.visual || "";
    const template = (novel.prompts && novel.prompts.image) ? novel.prompts.image : "";

    let finalOutput = cardContent;
    if (template) {
        if (template.includes("{content}")) {
            finalOutput = template.replace(/{content}/g, cardContent);
        } else {
            finalOutput = template + "\n\n" + cardContent;
        }
    }

    ctx.body = { success: true, data: finalOutput };
};

// 11. 保存视觉设定文本
export const saveVisualSettingText = async (ctx) => {
    const { id } = ctx.params;
    const { text } = ctx.request.body;

    try {
        await Chapter.findByIdAndUpdate(id, {
            visual_setting_text: text
        });
        ctx.body = { success: true };
    } catch (err) {
        console.error(err);
        ctx.status = 500;
        ctx.body = { success: false, message: "保存失败" };
    }
};

// 12. 上传/保存视觉设定图
export const uploadStyleImage = async (ctx) => {
    const { id } = ctx.params;
    const { image } = ctx.request.body;

    if (!image) {
        ctx.status = 400;
        ctx.body = { success: false, message: "未接收到图片数据" };
        return;
    }

    try {
        const chapter = await Chapter.findById(id);
        const novelIdStr = chapter.novelId.toString();
        const epFolder = `ep${chapter.order}`; 
        const targetDir = path.join(process.cwd(), 'assets', 'outputs', 'images', novelIdStr, epFolder);

        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        const dataBuffer = Buffer.from(base64Data, 'base64');

        const filePath = path.join(targetDir, 'style.png');
        fs.writeFileSync(filePath, dataBuffer);

        ctx.body = { success: true, message: "风格图保存成功" };

    } catch (err) {
        console.error(err);
        ctx.status = 500;
        ctx.body = { success: false, message: "保存失败: " + err.message };
    }
};

// 13. [核心更新] 图片分割逻辑 (Split Images)
export const splitImages = async (ctx) => {
    const { id } = ctx.params;

    try {
        const chapter = await Chapter.findById(id);
        if (!chapter) throw new Error("章节不存在");

        const novelIdStr = chapter.novelId.toString();
        const epFolder = `ep${chapter.order}`; 
        
        // 源目录: assets/outputs/images/novelId/epX
        const sourceDir = path.join(process.cwd(), 'assets', 'outputs', 'images', novelIdStr, epFolder);
        // 目标目录: sourceDir/ext
        const targetDir = path.join(sourceDir, 'ext');

        if (!fs.existsSync(sourceDir)) {
            throw new Error("图片目录不存在，请先生成图片");
        }

        // [新增] 每次处理前清空 ext 目录，确保无残留
        if (fs.existsSync(targetDir)) {
            // recursive: true 删除目录及其内容, force: true 忽略不存在的情况
            fs.rmSync(targetDir, { recursive: true, force: true });
        }
        // 重新创建 ext 目录
        fs.mkdirSync(targetDir, { recursive: true });

        // 读取所有 png 文件 (排除 style.png)
        const files = fs.readdirSync(sourceDir).filter(file => file.endsWith('.png') && file !== 'style.png');

        if (files.length === 0) {
            throw new Error("当前目录下没有可处理的 PNG 图片");
        }

        // [步骤 1] 扫描找出最大的数值 x (不包含 99)
        let maxIndex = 0;
        files.forEach(file => {
            const name = path.parse(file).name; // 文件名 (不含后缀)
            const num = parseInt(name, 10);
            if (!isNaN(num) && num !== 99) {
                if (num > maxIndex) maxIndex = num;
            }
        });

        let processedCount = 0;

        // [步骤 2] 并行处理
        await Promise.all(files.map(async (file) => {
            const fileName = path.parse(file).name;
            const inputPath = path.join(sourceDir, file);

            // 情况 A: 封面 0.png -> ext/0.jpg
            if (fileName === '0') {
                const outputPath = path.join(targetDir, '0.jpg');
                await sharp(inputPath)
                    .jpeg({ quality: 100 })
                    .toFile(outputPath);
            } 
            // 情况 B: 封底 99.png -> ext/(x+1).jpg
            else if (fileName === '99') {
                const newName = `${maxIndex + 1}.jpg`;
                const outputPath = path.join(targetDir, newName);
                await sharp(inputPath)
                    .jpeg({ quality: 100 })
                    .toFile(outputPath);
            } 
            // 情况 C: 普通图片 -> 4分割 -> ext/x-1.jpg ...
            else {
                // 定义 4 个区域 (总尺寸 1792x2400 -> 子尺寸 896x1200)
                const width = 896;
                const height = 1200;
                
                const regions = [
                    { left: 0, top: 0, suffix: '-1' },     // 左上
                    { left: width, top: 0, suffix: '-2' }, // 右上
                    { left: 0, top: height, suffix: '-3' },// 左下
                    { left: width, top: height, suffix: '-4' } // 右下
                ];

                for (const region of regions) {
                    const outputPath = path.join(targetDir, `${fileName}${region.suffix}.jpg`);
                    await sharp(inputPath)
                        .extract({ left: region.left, top: region.top, width: width, height: height })
                        .jpeg({ quality: 100 })
                        .toFile(outputPath);
                }
            }
            processedCount++;
        }));

        ctx.body = { 
            success: true, 
            message: `处理完成！已先清空 ext 目录，共处理 ${processedCount} 张原图。` 
        };

    } catch (err) {
        console.error(err);
        ctx.status = 500;
        ctx.body = { success: false, message: "图片分割失败: " + err.message };
    }
};

// ===================== TTS 工具函数与配置 =====================

// 1. 合并 WAV Buffer
const mergeWavBuffers = (buffers) => {
    if (!buffers.length) return null;
    const header = buffers[0].slice(0, 44);
    const channels = header.readUInt16LE(22);
    const sampleRate = header.readUInt32LE(24);
    const bitsPerSample = header.readUInt16LE(34);
    const dataParts = buffers.map(buf => buf.slice(44));

    // 生成 0.5秒 静音
    const SILENCE_DURATION = 0.5;
    const bytesPerSecond = sampleRate * channels * (bitsPerSample / 8);
    let silenceLength = Math.ceil(bytesPerSecond * SILENCE_DURATION);
    if (silenceLength % 2 !== 0) silenceLength++;
    const silenceBuffer = Buffer.alloc(silenceLength, 0);
    dataParts.push(silenceBuffer);

    const totalDataLength = dataParts.reduce((acc, part) => acc + part.length, 0);
    header.writeUInt32LE(36 + totalDataLength, 4);
    header.writeUInt32LE(totalDataLength, 40);

    return Buffer.concat([header, ...dataParts]);
};

// 2. 角色映射 (基于 process.cwd())
const getVoiceConfig = (key) => {
    const BASE_WAV_PATH = path.join(process.cwd(), 'assets', 'wav');
    
    // 默认映射表
    const VOICE_MAP = {
        "pangbai": { file: "huahuo_jidong.wav", text: "连锁反应开始了！绿色的水泡炸裂，脓水溅射到旁边的丧尸身上，迅速腐蚀。" },
        "xuangu": { file: "xuangu2.wav", text: "【默认】居勒什…应该在爷爷的卧室那边吧。他好像也很缅怀爷爷，但又不想当着我的面这样做。" },
        "ada": { file: "ada.wav", text: "【默认】本来这是我们全镇人为老板准备的礼物，打算在做好之后再向你揭晓。" },
        "xiaoliu": { file: "xiaoliu.wav", text: "【默认】它是基于人的生活诞生的美丽之物，每当有喜悦或值得庆祝的事，人们就会起舞。" },
        "leilaohu": { file: "nisheng.wav", text: "【默认】居然是好奇这个吗？呵呵，那我再讲明白一点吧。" },
        "liming": { file: "liming.wav", text: "【默认】本来这是我们全镇人为老板准备的礼物，打算在做好之后再向你揭晓。" },
        "tufu": { file: "tufu.wav", text: "【默认】哈哈哈哈哈，甚好甚好！且让善龙一观你有无真材实料！" }
    };

    const config = VOICE_MAP[key];
    if (!config) return null;

    return {
        ref_audio: path.join(BASE_WAV_PATH, config.file),
        ref_text: config.text
    };
};

// 3. 生成单句语音
const generateSingleVoice = async (text, characterKey) => {
    const config = getVoiceConfig(characterKey);
    if (!config || !fs.existsSync(config.ref_audio)) return null;

    const API_URL = "http://127.0.0.1:9880/tts";
    const payload = {
        text_lang: "zh",
        prompt_lang: "zh",
        text_split_method: "cut5",
        batch_size: 1,
        speed_factor: 1,
        media_type: "wav",
        streaming_mode: false,
        parallel_infer: true,
        repetition_penalty: 1.35,
        temperature: 0.95,
        Top_P: 0.95,
        text: text,
        ref_audio_path: config.ref_audio,
        prompt_text: config.ref_text
    };

    try {
        const { data } = await axios.post(API_URL, payload, { responseType: 'arraybuffer' });
        return data;
    } catch (err) {
        console.error(`TTS API Error (${characterKey}):`, err.message);
        return null;
    }
};

// ===================== Controller Method =====================

// 14. 生成语音 (Generate Audio)
export const generateAudio = async (ctx) => {
    const { id } = ctx.params;
    const { audioScript } = ctx.request.body; // Expects JSON string or object

    if (!audioScript) {
        ctx.status = 400;
        ctx.body = { success: false, message: "语音脚本不能为空" };
        return;
    }

    let scriptData;
    try {
        scriptData = typeof audioScript === 'string' ? JSON.parse(audioScript) : audioScript;
        // 兼容处理：如果是 { data: [...] } 格式，取 .data，否则直接用
        if (scriptData.data) scriptData = scriptData.data;
    } catch (e) {
        ctx.status = 400;
        ctx.body = { success: false, message: "JSON 解析失败" };
        return;
    }

    try {
        const chapter = await Chapter.findById(id);
        const novelIdStr = chapter.novelId.toString();
        const epFolder = `ep${chapter.order}`;
        
        // 输出目录: assets/outputs/images/:novelId/epX/audio
        const outputDir = path.join(process.cwd(), 'assets', 'outputs', 'images', novelIdStr, epFolder, 'audio');
        
        if (fs.existsSync(outputDir)) {
            fs.rmSync(outputDir, { recursive: true, force: true });
        }
        fs.mkdirSync(outputDir, { recursive: true });

        const generatedFiles = [];

        // 遍历结构: Page -> Shot (Panel) -> Lines
        // scriptData 应该是 Array<Array<Array<{key, value}>>> 或者是 Array<Array<{key, value}>> (兼容性)
        
        let totalCount = 0;

        // 递归处理或者按层级处理。根据你提供的 SCRIPT_JSON 结构：
        // data[pageIndex][shotIndex][lineIndex]
        
        if (!Array.isArray(scriptData)) throw new Error("脚本格式错误，应为数组");

        for (const [pageIndex, pageShots] of scriptData.entries()) {
            if (!Array.isArray(pageShots)) continue;

            // 判断是否是单镜头页 (可选逻辑，根据你的需求)
            const isSingleShotPage = pageShots.length === 1;

            for (const [shotIndex, shotLines] of pageShots.entries()) {
                if (!Array.isArray(shotLines)) continue;

                // 命名: 0-1.wav (第0页-第1镜) 或 0.wav
                // 为了前端排序方便，建议统一用 P-S 格式，或者如果只有1镜就是 P.wav
                let filename = isSingleShotPage ? `${pageIndex + 1}.wav` : `${pageIndex + 1}-${shotIndex + 1}.wav`;
                
                const shotBuffers = [];
                for (const line of shotLines) {
                    if (line.key && line.value) {
                        const audioBuffer = await generateSingleVoice(line.value, line.key);
                        if (audioBuffer) shotBuffers.push(audioBuffer);
                    }
                }

                if (shotBuffers.length > 0) {
                    const mergedBuffer = mergeWavBuffers(shotBuffers);
                    if (mergedBuffer) {
                        const filePath = path.join(outputDir, filename);
                        fs.writeFileSync(filePath, mergedBuffer);
                        
                        generatedFiles.push({
                            filename: filename,
                            url: `/images/${novelIdStr}/${epFolder}/audio/${filename}`
                        });
                        totalCount++;
                    }
                }
            }
        }

        ctx.body = { 
            success: true, 
            message: `成功生成 ${totalCount} 段音频`,
            files: generatedFiles
        };

    } catch (err) {
        console.error(err);
        ctx.status = 500;
        ctx.body = { success: false, message: "生成失败: " + err.message };
    }
};