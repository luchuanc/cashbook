/**
 * Gemini API 工具函数
 */

interface GeminiRequestContent {
  parts: {
    text: string;
  }[];
}

interface GeminiRequest {
  contents: GeminiRequestContent[];
}

interface GeminiResponseCandidate {
  content: {
    parts: {
      text: string;
    }[];
  };
}

interface GeminiResponse {
  candidates: GeminiResponseCandidate[];
}

/**
 * 调用 Gemini API 生成内容
 * @param prompt - 提示词
 * @param apiKey - Gemini API Key
 * @returns 生成的文本
 */
export const callGeminiAPI = async (
  prompt: string,
  apiKey: string
): Promise<string> => {
  if (!apiKey) {
    throw new Error("Gemini API Key 未配置");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const requestBody: GeminiRequest = {
    contents: [
      {
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(
        `Gemini API 请求失败: ${response.status} ${errorData}`
      );
    }

    const data: GeminiResponse = await response.json();

    // 提取响应中的文本
    if (
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0]
    ) {
      return data.candidates[0].content.parts[0].text;
    }

    throw new Error("Gemini API 返回数据格式错误");
  } catch (error: any) {
    console.error("Gemini API 调用失败:", error.message);
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
