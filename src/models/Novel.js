import mongoose from 'mongoose';

// 默认的提示词模板 (移到这里作为默认值)
const DEFAULT_SCRIPT_PROMPT = `# 你是一个优秀的漫画作者，擅长创作“都市修仙”题材...
(请保留您之前的完整 Prompt 内容作为默认值，为了代码简洁这里省略)`;

const DEFAULT_VISUAL_PROMPT = `# 你是顶级动漫美术总监。请分析以下小说片段...
(请保留您之前的完整 Prompt 内容作为默认值)`;

const DEFAULT_IMAGE_PROMPT = `masterpiece, best quality, 8k, anime style, highly detailed, cinematic lighting`;

const NovelSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, default: '' },
    cover: { type: String, default: 'https://placehold.co/300x400?text=No+Cover' },
    author: { type: String, default: 'Admin' },
    status: { type: String, enum: ['serial', 'completed'], default: 'serial' },
    
    // [新增] 提示词配置
    prompts: {
        script: { type: String, default: DEFAULT_SCRIPT_PROMPT }, // 剧本生成
        visual: { type: String, default: DEFAULT_VISUAL_PROMPT }, // 视觉设定
        image: { type: String, default: DEFAULT_IMAGE_PROMPT },   // 生图基底 (Base Prompt)
        audio: { type: String, default: "" }                      // 语音提示词 (预留)
    }
}, { timestamps: true });

export default mongoose.model('Novel', NovelSchema);