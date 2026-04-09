import prisma from "~~/server/lib/prisma";
import { success, error, getUserId } from "~~/server/utils/common";
import { callSupercomputingAPI, buildAnalysisPrompt } from "~~/server/utils/gemini";
import type { H3Event } from "h3";

/**
 * @swagger
 * /api/entry/analytics/ai-analysis:
 *   post:
 *     summary: 获取 AI 生成的月度财务分析建议
 *     tags: ["Analytics"]
 *     security:
 *       - Authorization: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             bookId: string 账本ID
 *             month: string 月份（YYYY-MM格式）
 *     responses:
 *       200:
 *         description: AI 分析结果获取成功
 *         content:
 *           application/json:
 *             schema:
 *               Result: {
 *                 d: {
 *                   analysis: AI生成的分析文本
 *                 }
 *               }
 *       400:
 *         description: 获取失败
 *         content:
 *           application/json:
 *             schema:
 *               Error: {
 *                 message: 错误信息
 *               }
 */
export default defineEventHandler(async (event: H3Event) => {
  try {
    // 获取请求参数
    const { bookId, month } = await readBody(event) as { bookId: string; month: string };

    // 参数验证
    if (!bookId) {
      return error("请先选择账本");
    }
    if (!month) {
      return error("请指定分析月份");
    }

    // 获取 API Key
    const config = useRuntimeConfig();
    const apiKey = config.supercomputingApiKey as string;

    if (!apiKey) {
      console.error("超算平台 API Key 未配置");
      return error("AI 分析功能未配置，请联系管理员");
    }

    // 构建数据库查询条件
    const where: any = {
      bookId,
      day: {
        startsWith: month,
      },
    };

    // 检查是否有该月份的数据
    const count = await prisma.flow.count({ where });
    if (count <= 0) {
      return error("该月份暂无流水数据");
    }

    // 获取月度统计数据
    const monthData = await getMonthAnalysisData(bookId, month, where);

    // 构建提示词并调用超算平台 API
    const prompt = buildAnalysisPrompt(monthData);
    const analysis = await callSupercomputingAPI(prompt, apiKey);

    // 返回分析结果
    return success({
      analysis: analysis.trim(),
      month: month,
    });
  } catch (err: any) {
    console.error("AI 分析请求失败:", err.message);
    return error(`AI 分析失败: ${err.message}`);
  }
});

/**
 * 获取月度分析数据（复用 monthAnalysis 的逻辑）
 */
async function getMonthAnalysisData(
  bookId: string,
  month: string,
  where: any
) {
  const res: any = {
    month,
    inSum: 0,
    outSum: 0,
    zeroSum: 0,
    maxInType: "",
    maxInTypeSum: 0,
    maxOutType: "",
    maxOutTypeSum: 0,
  };

  // 1. 按月查询当月总收入、总支出、总不计收支
  const monthSum = await prisma.flow.groupBy({
    by: ["flowType"],
    _sum: {
      money: true,
    },
    where,
  });

  monthSum.forEach((item: any) => {
    if (item.flowType == "收入") {
      res.inSum = (item._sum.money || 0).toFixed(2);
    } else if (item.flowType == "支出") {
      res.outSum = (item._sum.money || 0).toFixed(2);
    } else if (item.flowType == "不计收支") {
      res.zeroSum = (item._sum.money || 0).toFixed(2);
    }
  });

  // 2. 查询当月最高收入类型
  const maxInType = await prisma.flow.groupBy({
    by: ["industryType"],
    _sum: {
      money: true,
    },
    where: {
      ...where,
      flowType: "收入",
    },
    orderBy: {
      _sum: {
        money: "desc",
      },
    },
    take: 1,
  });

  if (maxInType[0]) {
    res.maxInType = maxInType[0].industryType || "";
    res.maxInTypeSum = (maxInType[0]._sum.money || 0).toFixed(2);
  }

  // 3. 查询当月最高支出类型
  const maxOutType = await prisma.flow.groupBy({
    by: ["industryType"],
    _sum: {
      money: true,
    },
    where: {
      ...where,
      flowType: "支出",
    },
    orderBy: {
      _sum: {
        money: "desc",
      },
    },
    take: 1,
  });

  if (maxOutType[0]) {
    res.maxOutType = maxOutType[0].industryType || "";
    res.maxOutTypeSum = (maxOutType[0]._sum.money || 0).toFixed(2);
  }

  return res;
}
