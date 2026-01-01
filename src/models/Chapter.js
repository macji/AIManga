import mongoose from 'mongoose';

const ChapterSchema = new mongoose.Schema({
    novelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Novel', required: true },
    title: { type: String, required: true },
    content: { type: String, required: true }, // 小说原文
    order: { type: Number, default: 0 }        // 排序用
}, { timestamps: true });

export default mongoose.model('Chapter', ChapterSchema);