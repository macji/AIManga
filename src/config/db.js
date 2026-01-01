import mongoose from 'mongoose';

export const connectDB = async () => {
    try {
        // 使用环境变量或默认本地地址
        const dbURI = process.env.MONGO_URI || 'mongodb://localhost:27017/aimanga';
        
        const conn = await mongoose.connect(dbURI);
        
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`❌ MongoDB Connection Error: ${error.message}`);
        // 连接失败则退出进程
        process.exit(1);
    }
};