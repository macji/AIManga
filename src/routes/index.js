import Router from 'koa-router';
import { 
    renderNovelList, 
    createNovel, 
    renderNovelDetail, 
    updateNovel, 
    createChapter,
    updateChapter,
    deleteChapter, // <--- 引入
    renderChapterDetail,
    importScript,
    getPanelPrompt
} from '../controllers/novelController.js';

const router = new Router();

// --- 小说相关路由 ---
router.get('/', renderNovelList);                  
router.post('/novel/create', createNovel);         
router.get('/novel/:id', renderNovelDetail);       
router.post('/novel/:id/update', updateNovel);     

// --- 章节相关路由 ---
router.post('/chapter/create', createChapter);     
router.post('/chapter/:id/update', updateChapter); 
router.post('/chapter/:id/delete', deleteChapter); // [新增] 删除章节
router.get('/chapter/:id', renderChapterDetail);   
router.post('/chapter/:id/import', importScript);  
router.get('/chapter/:id/panel/:panelId/prompt', getPanelPrompt); 

export default router;