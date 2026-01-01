import Router from 'koa-router';
import * as novelController from '../controllers/novelController.js';

const router = new Router();

// [修复] 首页路由 (核心缺失)
router.get('/', novelController.renderNovelList);

// 小说相关
router.get('/novel/:id', novelController.renderNovelDetail);
router.post('/novel/create', novelController.createNovel);
router.post('/novel/:id/update', novelController.updateNovel);

// 章节相关
router.get('/chapter/:id', novelController.renderChapterDetail);
router.post('/chapter/create', novelController.createChapter);
router.post('/chapter/:id/update', novelController.updateChapter);
router.post('/chapter/:id/delete', novelController.deleteChapter);
router.post('/chapter/:id/import', novelController.importScript);
router.get('/chapter/:id/panel/:panelId/prompt', novelController.getPanelPrompt);

// 视觉设定相关
router.post('/chapter/:id/save_setting_text', novelController.saveVisualSettingText);
router.post('/chapter/:id/upload_style', novelController.uploadStyleImage);

export default router;