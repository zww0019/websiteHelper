// Dify API 配置
const DIFY_API_KEY = 'app-URkurWqgBwoI7xjA9lEnUxN8';
const DIFY_API_URL = 'https://dify.zwwpc.top/v1/chat-messages';

// 监听扩展安装事件
chrome.runtime.onInstalled.addListener(() => {
  console.log('网页助手已安装');
});

// 监听扩展图标点击事件
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { action: 'toggleAssistant' });
});

// 处理流式响应数据
async function handleStreamResponse(response, onMessage, onError) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || ''; // 保留最后一个不完整的块

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            switch (data.event) {
              case 'message':
                onMessage({
                  type: 'message',
                  content: data.answer,
                  taskId: data.task_id,
                  messageId: data.message_id,
                  conversationId: data.conversation_id
                });
                break;
              
              case 'message_end':
                onMessage({
                  type: 'end',
                  taskId: data.task_id,
                  messageId: data.message_id,
                  conversationId: data.conversation_id,
                  metadata: data.metadata,
                  usage: data.usage,
                  retrieverResources: data.retriever_resources
                });
                break;
              
              case 'error':
                onError({
                  taskId: data.task_id,
                  messageId: data.message_id,
                  status: data.status,
                  code: data.code,
                  message: data.message
                });
                break;
              
              case 'ping':
                // 处理心跳包，保持连接
                break;
              
              case 'message_replace':
                onMessage({
                  type: 'replace',
                  content: data.answer,
                  taskId: data.task_id,
                  messageId: data.message_id,
                  conversationId: data.conversation_id
                });
                break;
            }
          } catch (e) {
            console.error('解析流数据出错：', e);
          }
        }
      }
    }
  } catch (error) {
    onError({
      message: error.message
    });
  }
}

// 调用 Dify API 生成摘要
async function generateSummary(content, tabId) {
  try {
    const response = await fetch(DIFY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DIFY_API_KEY}`
      },
      body: JSON.stringify({
        inputs: {},
        query: `请总结以下网页内容：\n标题：${content.title}\n描述：${content.description}\n内容：${content.mainContent}`,
        response_mode: 'streaming',
        user: 'web-extension'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    let fullSummary = '';
    
    await handleStreamResponse(
      response,
      (message) => {
        if (message.type === 'message') {
          fullSummary += message.content;
          // 发送部分结果到 content script
          chrome.tabs.sendMessage(tabId, {
            action: 'updateSummary',
            partialSummary: fullSummary,
            taskId: message.taskId,
            messageId: message.messageId
          }).catch(error => {
            console.error('发送消息失败：', error);
          });
        } else if (message.type === 'end') {
          // 处理消息结束事件
          chrome.tabs.sendMessage(tabId, {
            action: 'summaryComplete',
            taskId: message.taskId,
            messageId: message.messageId,
            metadata: message.metadata,
            usage: message.usage
          }).catch(error => {
            console.error('发送完成消息失败：', error);
          });
        }
      },
      (error) => {
        console.error('生成摘要时出错：', error);
        chrome.tabs.sendMessage(tabId, {
          action: 'summaryError',
          error: error.message
        }).catch(error => {
          console.error('发送错误消息失败：', error);
        });
      }
    );

    return fullSummary;
  } catch (error) {
    console.error('生成摘要时出错：', error);
    return '生成摘要时出错，请稍后重试。';
  }
}

// 调用 Dify API 回答问题
async function askQuestion(question, content, tabId) {
  try {
    const response = await fetch(DIFY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DIFY_API_KEY}`
      },
      body: JSON.stringify({
        inputs: {},
        query: `基于以下网页内容回答问题：\n标题：${content.title}\n描述：${content.description}\n内容：${content.mainContent}\n\n问题：${question}`,
        response_mode: 'streaming',
        user: 'web-extension'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    let fullAnswer = '';
    
    await handleStreamResponse(
      response,
      (message) => {
        if (message.type === 'message') {
          fullAnswer += message.content;
          // 发送部分结果到 content script
          chrome.tabs.sendMessage(tabId, {
            action: 'updateAnswer',
            partialAnswer: fullAnswer,
            taskId: message.taskId,
            messageId: message.messageId
          }).catch(error => {
            console.error('发送消息失败：', error);
          });
        } else if (message.type === 'end') {
          // 处理消息结束事件
          chrome.tabs.sendMessage(tabId, {
            action: 'answerComplete',
            taskId: message.taskId,
            messageId: message.messageId,
            metadata: message.metadata,
            usage: message.usage
          }).catch(error => {
            console.error('发送完成消息失败：', error);
          });
        }
      },
      (error) => {
        console.error('回答问题时出错：', error);
        chrome.tabs.sendMessage(tabId, {
          action: 'answerError',
          error: error.message
        }).catch(error => {
          console.error('发送错误消息失败：', error);
        });
      }
    );

    return fullAnswer;
  } catch (error) {
    console.error('回答问题时出错：', error);
    return '回答问题时出错，请稍后重试。';
  }
}

// 监听来自 content script 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'generateSummary') {
    generateSummary(request.content, sender.tab.id)
      .then(summary => sendResponse({ summary }))
      .catch(error => sendResponse({ error: error.message }));
    return true; // 保持消息通道开放
  }
  
  if (request.action === 'askQuestion') {
    askQuestion(request.question, request.content, sender.tab.id)
      .then(answer => sendResponse({ answer }))
      .catch(error => sendResponse({ error: error.message }));
    return true; // 保持消息通道开放
  }

  switch (request.action) {
    case 'updateSummary':
      updateSummaryDisplay(request.partialSummary);
      break;
    case 'summaryComplete':
      handleSummaryComplete(request.metadata, request.usage);
      break;
    case 'summaryError':
      handleSummaryError(request.error);
      break;
    case 'updateAnswer':
      updateAnswerDisplay(request.partialAnswer);
      break;
    case 'answerComplete':
      handleAnswerComplete(request.metadata, request.usage);
      break;
    case 'answerError':
      handleAnswerError(request.error);
      break;
  }
});