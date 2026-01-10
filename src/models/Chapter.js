import mongoose from 'mongoose';

const ChapterSchema = new mongoose.Schema({
    novelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Novel', required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    order: { type: Number, default: 0 },
    
    // 用于存储用户输入的视觉设定草稿
    visual_setting_text: { type: String, default: "" },

    // [新增] 作品总结/摘要
    summary: { type: String, default: "" },

    script_data: [{
        id: String,
        visual: String,
        prompt_visual: String,
        env: String,
        composition: String,
        lines: [{
            role: String,
            content: String
        }],
        image_index: Number
    }]
}, { timestamps: true });

export default mongoose.model('Chapter', ChapterSchema);