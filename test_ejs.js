import ejs from 'ejs';
import fs from 'fs';

const template = fs.readFileSync('./src/views/chapter_detail.ejs', 'utf8');
try {
    ejs.compile(template);
    console.log('✅ EJS模板编译成功，没有语法错误');
} catch (error) {
    console.error('❌ EJS模板编译失败:', error);
    console.error('错误位置:', error.line, error.col);
}