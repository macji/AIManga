import Novel from '../models/Novel.js';
import Chapter from '../models/Chapter.js';
import fs from 'fs';
import path from 'path';

// --- 删除引用：import { buildImagePrompt } from '../prompt/index.js'; ---
// 因为我们现在使用模板替换逻辑，不再需要这个函数

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

// 9. 导入脚本 (importScript)
export const importScript = async (ctx) => {
    const { id } = ctx.params;
    const { rawScript } = ctx.request.body;

    // --- 1. 清洗 JSON 数据 ---
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

    // --- 2. 数据映射 (按 Page 聚合 + Markdown 格式化) ---
    let flatPanels = [];
    try {
        const pages = parsedData.pages || (Array.isArray(parsedData) ? parsedData : []);

        if (pages.length > 0) {
            pages.forEach((page, pIndex) => {
                const pageNum = page.page_number || (pIndex + 1);
                
                // --- 构建显示用的 Markdown 文本 ---
                let displayContent = `**P${pageNum}**\n\n`;
                
                // 处理 Panels
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
                // 兼容逻辑
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

    // --- 3. 补充索引 (从 1 开始) ---
    flatPanels = flatPanels.map((panel, index) => ({
        ...panel,
        image_index: index + 1 
    }));

    // --- 4. 自动创建目录 ---
    const chapter = await Chapter.findById(id);
    const novelIdStr = chapter.novelId.toString();
    const epFolder = `ep${chapter.order}`; 
    const targetDir = path.join(process.cwd(), 'assets', 'outputs', 'images', novelIdStr, epFolder);
    
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    // --- 5. 更新 DB ---
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

// 10. 获取单卡片 Prompt (无 buildImagePrompt 依赖)
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

// [新增] 保存视觉设定文本 (AJAX调用)
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

// [新增] 上传/保存视觉设定图 (style.png)
export const uploadStyleImage = async (ctx) => {
    const { id } = ctx.params;
    const { image } = ctx.request.body; // Base64 字符串

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

        // 确保目录存在
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        // 处理 Base64 (去掉 data:image/png;base64, 前缀)
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        const dataBuffer = Buffer.from(base64Data, 'base64');

        // 写入 style.png
        const filePath = path.join(targetDir, 'style.png');
        fs.writeFileSync(filePath, dataBuffer);

        ctx.body = { success: true, message: "风格图保存成功" };

    } catch (err) {
        console.error(err);
        ctx.status = 500;
        ctx.body = { success: false, message: "保存失败: " + err.message };
    }
};