import mongoose from 'mongoose';

const ChapterSchema = new mongoose.Schema({
    novelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Novel', required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    order: { type: Number, default: 0 },
    
    script_data: [{
        id: String,
        visual: String,         // 存给人看的：完整 Markdown 格式脚本
        prompt_visual: String,  // [新增] 存给AI看的：纯净画面描述拼接
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