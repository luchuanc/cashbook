/**
 * 超算平台 API 工具函数
 * OpenAI 兼容接口，用于调用 SCNet 平台上的大模型
 */

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface SupercomputingRequest {
  model: string;
  messages: Message[];
  stream?: boolean;
  enable_thinking?: boolean;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  response_format?: {
    type: "text" | "json_object";
  };
}

interface SupercomputingResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/**
 * 调用超算平台 API 生成内容
 * @param prompt - 提示词
 * @param apiKey - 超算平台 API Key
 * @returns 生成的文本
 */
export const callSupercomputingAPI = async (
  prompt: string,
  apiKey: string,
  options?: {
    systemPrompt?: string;
    model?: string;
    enableThinking?: boolean;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    responseFormat?: "text" | "json_object";
  }
): Promise<string> => {
  if (!apiKey) {
    throw new Error("超算平台 API Key 未配置");
  }

  const url = "https://api.scnet.cn/api/llm/v1/chat/completions";

  const requestBody: SupercomputingRequest = {
    model: options?.model || "DeepSeek-R1-Distill-Qwen-7B",
    messages: [
      {
        role: "system",
        content:
          options?.systemPrompt || "你是一个个人财务分析助手，提供专业的财务建议。",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    stream: false,
  };
  if (typeof options?.enableThinking === "boolean") {
    requestBody.enable_thinking = options.enableThinking;
  }
  if (typeof options?.maxTokens === "number") {
    requestBody.max_tokens = options.maxTokens;
  }
  if (typeof options?.temperature === "number") {
    requestBody.temperature = options.temperature;
  }
  if (typeof options?.topP === "number") {
    requestBody.top_p = options.topP;
  }
  if (options?.responseFormat) {
    requestBody.response_format = { type: options.responseFormat };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(
        `超算平台 API 请求失败: ${response.status} ${errorData}`
      );
    }

    const data: any = await response.json();
    
    console.debug("超算平台 API 响应:", JSON.stringify(data, null, 2));

    // 提取响应中的文本 - 尝试多种格式兼容
    let content = "";
    if (data.choices && data.choices[0]) {
      // OpenAI 标准格式
      if (data.choices[0].message && data.choices[0].message.content) {
        content = data.choices[0].message.content;
      }
      // 备选格式1: text 属性
      else if (data.choices[0].text) {
        content = data.choices[0].text;
      }
    }
    
    // 其他可能的格式
    if (!content) {
      if (data.result && typeof data.result === 'string') {
        content = data.result;
      } else if (data.data && typeof data.data === 'string') {
        content = data.data;
      }
    }

    if (!content) {
      console.error("超算平台 API 返回数据格式错误，完整响应:", JSON.stringify(data));
      throw new Error(`超算平台 API 返回数据格式错误: ${JSON.stringify(data)}`);
    }

    // 过滤掉 <think>...</think> 标签（DeepSeek 模型的思考过程）
    content = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    
    return content;
  } catch (error: any) {
    console.error("超算平台 API 调用失败:", error.message);
    throw error;
  }
};

/**
 * 构建月度分析提示词
 * @param monthData - 月度数据对象
 * @returns 格式化的提示词
 */
export const buildAnalysisPrompt = (monthData: any): string => {
  const systemPrompt = `你是一个个人财务分析助手，请根据以下账单数据生成一份详细的月度财务分析报告。

要求：
1. 分为5部分：总体情况、消费结构、异常变化、主要消费、建议
2. 语言简洁自然，不超过200字
3. 必须指出最重要的变化原因
4. 给出1-2条具体建议

报告格式示例：
【总体情况】本月支出XX元，较上月...
【消费结构】主要支出集中在...，占比...
【异常变化】最显著的变化是...，原因是...
【主要消费】最大单笔支出...，最大类型...
【建议】1. ... 2. ...

数据：`;

  // 格式化月度数据为更可读的形式
  const dataStr = `
{
  "月份": "${monthData.month}",
  "总收入": "${monthData.inSum || 0}元",
  "总支出": "${monthData.outSum || 0}元",
  "结余": "${(Number(monthData.inSum || 0) - Number(monthData.outSum || 0)).toFixed(2)}元",
  "不计收支": "${monthData.zeroSum || 0}元",
  "最大收入来源": "${monthData.maxInType || '无'} (¥${monthData.maxInTypeSum || 0})",
  "最大支出类型": "${monthData.maxOutType || '无'} (¥${monthData.maxOutTypeSum || 0})"
}`;

  return systemPrompt + dataStr;
};
