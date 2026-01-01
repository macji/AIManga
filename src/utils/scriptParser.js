// src/utils/scriptParser.js
export const parseScript = (markdownText) => {
    const panels = [];
    // 匹配 Panel 行，例如 "**Panel 1-1**" 或 "Panel 1-1"
    const panelRegex = /Panel\s+(\d+-\d+)/i;
    
    // 按行分割
    const lines = markdownText.split('\n');
    
    let currentPanel = null;
    
    lines.forEach(line => {
        const cleanLine = line.trim();
        if (!cleanLine) return;

        // 1. 检测是否是新 Panel
        const panelMatch = cleanLine.match(panelRegex);
        if (panelMatch) {
            // 保存旧的
            if (currentPanel) panels.push(currentPanel);
            
            // 开启新的
            currentPanel = {
                id: panelMatch[1], // "1-1"
                visual: "",        // 画面
                env: "",           // 环境
                lines: [],         // 台词/独白
                raw_text: ""       // 原始文本留底
            };
            return;
        }

        // 2. 如果在 Panel 内部，解析属性
        if (currentPanel) {
            currentPanel.raw_text += cleanLine + "\n";

            // 提取画面 (支持 "**画面：**..." 或 "画面：...")
            if (cleanLine.match(/(\*\*|)?画面(：|:)(\*\*|)?/)) {
                currentPanel.visual = cleanLine.replace(/.*画面(：|:)(\*\*|)?/, '').trim();
            }
            // 提取环境
            else if (cleanLine.match(/(\*\*|)?环境(细节)?(：|:)(\*\*|)?/)) {
                currentPanel.env = cleanLine.replace(/.*环境(细节)?(：|:)(\*\*|)?/, '').trim();
            }
            // 提取景别 (可选)
            else if (cleanLine.match(/(\*\*|)?景别(：|:)(\*\*|)?/)) {
                currentPanel.composition = cleanLine.replace(/.*景别(：|:)(\*\*|)?/, '').trim();
            }
            // 提取对话 (假设格式： 角色名：对话内容)
            else if (cleanLine.includes('：') || cleanLine.includes(':')) {
                // 简单的对话提取逻辑，排除掉前面已经匹配的关键词
                const parts = cleanLine.split(/：|:/);
                if (parts.length >= 2) {
                    const role = parts[0].replace(/\*|/g, '').trim();
                    const content = parts[1].trim();
                    currentPanel.lines.push({ role, content });
                }
            }
        }
    });

    // 推入最后一个
    if (currentPanel) panels.push(currentPanel);

    return panels;
};