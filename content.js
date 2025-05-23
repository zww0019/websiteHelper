// 监听来自扩展图标的点击
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === 'toggleAssistant') {
    const existingAssistant = document.getElementById('webpage-assistant');
    if (existingAssistant) {
      existingAssistant.remove();
    } else {
      initializeAssistant();
    }
  }
});

// 创建助手界面
function createAssistantUI() {
  // 创建助手容器
  const assistant = document.createElement('div');
  assistant.id = 'webpage-assistant';
  assistant.className = 'webpage-assistant';
  
  // 设置助手样式
  assistant.style.cssText = `
    position: fixed;
    right: 20px;
    top: 20px;
    width: 40vw;
    height: 70vh;
    border: none;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    z-index: 999999;
    background: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    display: flex;
    flex-direction: column;
  `;

  // 创建助手内容
  assistant.innerHTML = `
    <div class="assistant-header" style="
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background-color: #1a73e8;
      color: white;
      border-radius: 8px 8px 0 0;
      flex-shrink: 0;
    ">
      <h2 style="
        margin: 0;
        font-size: 18px;
        color: white;
      ">网页助手</h2>
      <button class="toggle-btn" style="
        background: none;
        border: 1px solid white;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      ">收起</button>
    </div>
    <div class="assistant-content" style="
      padding: 16px;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 16px;
      overflow: hidden;
    ">
      <div class="summary-section" style="
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
      ">
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          flex-shrink: 0;
        ">
          <h3 style="
            color: #333;
            font-size: 16px;
            margin: 0;
          ">网页摘要</h3>
          <button id="regenerate-summary" style="
            background-color: #1a73e8;
            color: white;
            border: none;
            padding: 4px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: background-color 0.2s;
          ">重新生成</button>
        </div>
        <div id="summary" class="summary-box markdown-body" style="
          background-color: #f5f5f5;
          padding: 12px;
          border-radius: 6px;
          flex: 1;
          overflow-y: auto;
          font-size: 14px;
          line-height: 1.5;
          min-height: 0;
        ">
          正在生成摘要...
        </div>
      </div>
      <div class="qa-section" style="
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
      ">
        <h3 style="
          color: #333;
          font-size: 16px;
          margin: 0 0 8px 0;
          flex-shrink: 0;
        ">智能问答</h3>
        <div class="input-group" style="
          display: flex;
          gap: 8px;
          margin-bottom: 8px;
          flex-shrink: 0;
        ">
          <input type="text" id="question" placeholder="请输入您的问题..." style="
            flex: 1;
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
          ">
          <button id="ask" style="
            background-color: #1a73e8;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: background-color 0.2s;
          ">提问</button>
        </div>
        <div id="answer" class="answer-box markdown-body" style="
          background-color: #f5f5f5;
          padding: 12px;
          border-radius: 6px;
          flex: 1;
          overflow-y: auto;
          font-size: 14px;
          line-height: 1.5;
          min-height: 0;
        ">
          答案将在这里显示...
        </div>
      </div>
    </div>
  `;

  // 添加到页面
  document.body.appendChild(assistant);

  // 设置事件监听器
  const askButton = assistant.querySelector('#ask');
  const questionInput = assistant.querySelector('#question');
  const toggleBtn = assistant.querySelector('.toggle-btn');
  const summaryBox = assistant.querySelector('#summary');
  const answerBox = assistant.querySelector('#answer');
  const regenerateButton = assistant.querySelector('#regenerate-summary');

  // 配置 marked 选项
  marked.setOptions({
    breaks: true, // 支持 GitHub 风格的换行
    //gfm: true, // 启用 GitHub 风格的 Markdown
    headerIds: false, // 禁用标题 ID
    mangle: false, // 禁用标题 ID 混淆
    sanitize: false // 允许 HTML 标签
  });

  // 添加重新生成按钮事件监听
  regenerateButton.addEventListener('click', () => {
    regenerateButton.disabled = true;
    summaryBox.innerHTML = '正在重新生成摘要...';
    
    // 发送消息给 background script 重新生成摘要
    chrome.runtime.sendMessage(
      { action: 'generateSummary', content: window.pageContent },
      response => {
        regenerateButton.disabled = false;
        if (response.error) {
          summaryBox.innerHTML = '生成摘要时出错，请稍后重试。';
        }
      }
    );
  });

  askButton.addEventListener('click', () => {
    const question = questionInput.value.trim();
    if (!question) return;

    askButton.disabled = true;
    answerBox.innerHTML = '正在思考...';

    // 发送消息给 background script
    chrome.runtime.sendMessage(
      { action: 'askQuestion', question: question, content: window.pageContent },
      response => {
        askButton.disabled = false;
        if (response.error) {
          answerBox.innerHTML = '回答问题时出错，请稍后重试。';
        }
      }
    );
  });

  questionInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      askButton.click();
    }
  });

  toggleBtn.addEventListener('click', () => {
    const content = assistant.querySelector('.assistant-content');
    const isCollapsed = content.style.display === 'none';
    content.style.display = isCollapsed ? 'flex' : 'none';
    toggleBtn.textContent = isCollapsed ? '收起' : '展开';
  });

  return assistant;
}

// 提取网页主要内容
function extractMainContent() {
  try {
    // 创建 Readability 实例
    const documentClone = document.cloneNode(true);
    const reader = new Readability(documentClone);
    
    // 解析文章内容
    const article = reader.parse();
    
    if (!article) {
      console.log('Readability 解析失败，使用备用方案');
      return {
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.content || '',
        mainContent: document.body.innerText,
        url: window.location.href
      };
    }

    // 返回提取的内容
    return {
      title: article.title,
      description: article.excerpt || '',
      mainContent: article.content,
      url: window.location.href,
      byline: article.byline,
      siteName: article.siteName,
      publishedTime: article.publishedTime
    };
  } catch (error) {
    console.error('提取内容时出错：', error);
    return {
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content || '',
      mainContent: document.body.innerText,
      url: window.location.href
    };
  }
}

// 初始化助手
async function initializeAssistant() {
  const assistant = createAssistantUI();
  const content = extractMainContent();
  
  // 通过消息获取摘要
  chrome.runtime.sendMessage(
    { action: 'generateSummary', content },
    response => {
      if (response.error) {
        assistant.querySelector('#summary').textContent = '生成摘要时出错，请稍后重试。';
      }
    }
  );
  
  // 存储页面内容供后续问答使用
  window.pageContent = content;

  // 监听来自 assistant 的消息
  window.addEventListener('message', async (event) => {
    if (event.data.type === 'askQuestion') {
      chrome.runtime.sendMessage(
        { action: 'askQuestion', question: event.data.question, content: window.pageContent },
        response => {
          if (response.error) {
            assistant.querySelector('#answer').textContent = '回答问题时出错，请稍后重试。';
          }
        }
      );
    }
  });
}

// 监听来自 background 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const assistant = document.getElementById('webpage-assistant');
  if (!assistant) {
    return;
  }

  try {
    const summaryBox = assistant.querySelector('#summary');
    const answerBox = assistant.querySelector('#answer');

    switch (request.action) {
      case 'updateSummary':
        if (summaryBox) {
          summaryBox.innerHTML = marked.parse(request.partialSummary);
        }
        break;
      
      case 'summaryComplete':
        break;
      
      case 'summaryError':
        if (summaryBox) {
          summaryBox.innerHTML = `生成摘要时出错：${request.error}`;
        }
        break;
      
      case 'updateAnswer':
        if (answerBox) {
          answerBox.innerHTML = marked.parse(request.partialAnswer);
        }
        break;
      
      case 'answerComplete':
        break;
      
      case 'answerError':
        if (answerBox) {
          answerBox.innerHTML = `回答问题时出错：${request.error}`;
        }
        break;
    }
  } catch (error) {
    console.error('处理消息时出错：', error);
  }
}); 