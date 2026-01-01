import Novel from '../models/Novel.js';
import Chapter from '../models/Chapter.js';
import { buildImagePrompt } from '../prompt/index.js';
import fs from 'fs';
import path from 'path';

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

// 4. 更新小说信息
export const updateNovel = async (ctx) => {
    const { id } = ctx.params;
    // [修复] 从 request.body 中解构出 prompts
    const { title, author, status, description, cover, prompts } = ctx.request.body;
    
    // 构建更新对象
    const updateData = { 
        title, 
        author, 
        status, 
        description, 
        cover 
    };

    // [修复] 如果前端提交了 prompts (来自配置弹窗)，则将其合并入更新数据
    // koa-bodyparser 会自动处理 name="prompts[script]" 这种表单格式为对象
    if (prompts) {
        updateData.prompts = prompts;
    }

    await Novel.findByIdAndUpdate(id, updateData);
    
    // 保持重定向逻辑不变
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

// 9. [核心修改] 导入脚本 (适配您的 JSON 结构)
export const importScript = async (ctx) => {
    const { id } = ctx.params;
    const { rawScript } = ctx.request.body;

    const chapter = await Chapter.findById(id);
    if (!chapter) {
        ctx.status = 404;
        return;
    }

    let parsedData;
    try {
        parsedData = JSON.parse(rawScript);
    } catch (e) {
        ctx.body = "Error: Invalid JSON format";
        return;
    }

    // --- 数据映射逻辑 ---
    let flatPanels = [];
    if (parsedData.pages && Array.isArray(parsedData.pages)) {
        parsedData.pages.forEach(page => {
            if (page.panels && Array.isArray(page.panels)) {
                page.panels.forEach(p => {
                    flatPanels.push({
                        id: p.panel_id,
                        // 映射您的 JSON 字段到 DB 字段
                        visual: p.visual_description,  // 画面描述
                        env: p.environment_details,    // 环境细节
                        composition: p.shot_type,      // 景别
                        lines: p.audio_elements ? p.audio_elements.map(a => ({
                            role: a.speaker,
                            content: a.text
                        })) : []
                    });
                });
            }
        });
    }

    // 增加 image_index (0, 1, 2...)
    flatPanels = flatPanels.map((panel, index) => ({
        ...panel,
        image_index: index
    }));

    // 自动创建目录
    const novelIdStr = chapter.novelId.toString();
    const epFolder = `ep${chapter.order}`; 
    const targetDir = path.join(process.cwd(), 'assets', 'outputs', 'images', novelIdStr, epFolder);

    try {
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
    } catch (err) {
        console.error("❌ 创建目录失败:", err);
    }

    // 更新 DB
    await Chapter.findByIdAndUpdate(id, {
        script_data: flatPanels
    });

    ctx.redirect(`/chapter/${id}`);
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

    // 使用 Novel 配置的 Image Prompt
    const basePrompt = novel.prompts ? novel.prompts.image : "";
    const result = buildImagePrompt(panel, basePrompt);

    ctx.body = { success: true, data: result.positive };
};