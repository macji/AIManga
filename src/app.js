import Koa from 'koa';
import views from 'koa-views';
import serve from 'koa-static';
import bodyParser from 'koa-bodyparser';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// 引入数据库连接模块
import { connectDB } from './config/db.js';
import router from './routes/index.js';

// 1. 初始化配置
dotenv.config(); // 加载 .env 文件
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = new Koa();

// 2. 连接数据库
connectDB();

// 3. 中间件配置
app.use(serve(path.join(__dirname, '../public')));
app.use(bodyParser({
    enableTypes: ['json', 'form', 'text'],
    formLimit: '50mb',
    jsonLimit: '50mb',
    textLimit: '50mb',
    xmlLimit: '50mb'
}));
app.use(bodyParser());

// [新增] 挂载生成的图片目录，访问路径为 /outputs/images/xxx.png
app.use(serve(path.join(__dirname, '../assets/outputs')));
// 注意：koa-static 本身不支持 mount prefix，通常用 koa-mount。
// 如果没有 koa-mount，我们可以直接 serve assets 根目录
app.use(serve(path.join(__dirname, '../assets')));

// 配置 EJS 模板引擎
app.use(views(path.join(__dirname, 'views'), {
    extension: 'ejs'
}));

// 4. 挂载路由
app.use(router.routes()).use(router.allowedMethods());

// 5. 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 AIManga Server running at http://localhost:${PORT}`);
});