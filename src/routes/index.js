import Router from 'koa-router';
import * as novelController from '../controllers/novelController.js';

const router = new Router();

// 首页
router.get('/', novelController.renderNovelList);

// 小说相关
router.get('/novel/:id', novelController.renderNovelDetail);
router.post('/novel/create', novelController.createNovel);
router.post('/novel/:id/update', novelController.updateNovel);
router.get('/novel/:id/prompts', novelController.renderNovelPrompts);

// 章节相关 - 基础操作
router.post('/chapter/create', novelController.createChapter);
router.post('/chapter/:id/update', novelController.updateChapter);
router.post('/chapter/:id/delete', novelController.deleteChapter);

// 章节详情 - 独立页面路由 (Tab 页)
router.get('/chapter/:id', novelController.redirectChapterDetail); // 默认跳转
router.get('/chapter/:id/script', novelController.renderChapterPage);  // 提示词生成
router.get('/chapter/:id/setting', novelController.renderChapterPage); // 视觉设定
router.get('/chapter/:id/panels', novelController.renderChapterPage);  // 分镜制作
router.get('/chapter/:id/split', novelController.renderChapterPage);   // 图片分割
router.get('/chapter/:id/audio', novelController.renderChapterPage);   // 语音字幕
router.get('/chapter/:id/video', novelController.renderChapterPage);   // 视频生成

// 章节功能 API
router.post('/chapter/:id/import', novelController.importScript);
router.get('/chapter/:id/panel/:panelId/prompt', novelController.getPanelPrompt);
router.post('/chapter/:id/save_setting_text', novelController.saveVisualSettingText);
router.post('/chapter/:id/upload_style', novelController.uploadStyleImage);
router.post('/chapter/:id/split_images', novelController.splitImages);
router.post('/chapter/:id/generate_audio', novelController.generateAudio);
// [新增] 小说 Logo 上传
router.post('/novel/:id/upload_logo', novelController.uploadNovelLogo);

// [新增] 上传页面图片
router.post('/chapter/:id/upload_page_image', novelController.uploadPageImage); 

export default router;