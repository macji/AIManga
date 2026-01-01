import mongoose from 'mongoose';

const NovelSchema = new mongoose.Schema({
    title: { type: String, required: true },
    author: { type: String, default: 'Unknown' },
    cover: { type: String, default: '' },
    description: { type: String, default: '' },
    status: { type: String, default: 'serial', enum: ['serial', 'completed'] },
    
    // 提示词模板配置
    prompts: {
        script: { type: String, default: "" },        // 剧本
        visual: { type: String, default: "" },        // 视觉提取
        visual_setting: { type: String, default: "" },// 视觉设定 (新增)
        image: { type: String, default: "" },         // 分镜生图
        
        // [新增] 语音字幕 Prompt
        audio: { type: String, default: "" }          
    }
}, { timestamps: true });

export default mongoose.model('Novel', NovelSchema);