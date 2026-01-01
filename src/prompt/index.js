// src/prompt/index.js

const NEGATIVE_PROMPT = "nsfw, low quality, worst quality, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, jpeg artifacts, signature, watermark, username, blurry";

/**
 * 核心拼接函数
 * @param {Object} panel - 分镜对象
 * @param {string} basePrompt - 从 Novel 配置中传入的基础画风
 */
export const buildImagePrompt = (panel, basePrompt) => {
    let finalPositive = "";
    
    // 准备要插入的内容部分 (Composition + Visual + Env)
    let contentParts = [];
    if (panel.composition) contentParts.push(panel.composition);
    if (panel.visual) contentParts.push(panel.visual);
    if (panel.env) contentParts.push(`background: ${panel.env}`);
    
    const visualContent = contentParts.join(", ");

    // 1. 处理基础画风与内容的拼接
    if (basePrompt) {
        // [新特性] 支持 {content} 占位符
        if (basePrompt.includes("{content}")) {
            finalPositive = basePrompt.replace(/{content}/g, visualContent);
        } else {
            // 旧逻辑：如果没有占位符，则默认：基础画风 + 内容
            finalPositive = `${basePrompt}, ${visualContent}`;
        }
    } else {
        // 兜底逻辑
        finalPositive = `masterpiece, best quality, anime style, ${visualContent}`;
    }

    return {
        positive: finalPositive,
        negative: NEGATIVE_PROMPT
    };
};