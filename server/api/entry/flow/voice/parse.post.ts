import prisma from "~~/server/lib/prisma";
import { callSupercomputingAPI } from "~~/server/utils/gemini";
import { transcribeAudioByXunfeiIat } from "~~/server/utils/xunfei";
import { error, getUserId, success } from "~~/server/utils/common";

interface VoiceDraftFlow {
  day: string;
  flowType: string;
  industryType: string;
  payType: string;
  money: number | null;
  attribution: string;
  name: string;
  description: string;
}

const FLOW_TYPES = new Set(["支出", "收入", "不计收支"]);

const extractJson = (text: string): any => {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("大模型未返回 JSON");
  }
  return JSON.parse(text.slice(start, end + 1));
};

const normalizeDate = (value: any, fallback: string): string => {
  if (typeof value !== "string") return fallback;
  const hit = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!hit) return fallback;
  return value;
};

const normalizeMoney = (value: any): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 0 ? Number(value.toFixed(2)) : null;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.-]/g, "");
    const n = Number(cleaned);
    if (Number.isFinite(n) && n > 0) return Number(n.toFixed(2));
  }
  return null;
};

const pad2 = (n: number) => String(n).padStart(2, "0");

const formatLocalDate = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const safeDate = (year: number, month: number, day: number): string => {
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return "";
  }
  return formatLocalDate(date);
};

const shiftDays = (base: Date, delta: number): string => {
  const d = new Date(base);
  d.setDate(d.getDate() + delta);
  return formatLocalDate(d);
};

const parseDateFromTranscript = (
  text: string,
  fallbackDate: string
): string => {
  if (!text) return "";
  const base = new Date(`${fallbackDate}T12:00:00`);
  if (Number.isNaN(base.getTime())) return "";

  const normalized = text.replace(/\s+/g, "");

  if (/今天|今日/.test(normalized)) return formatLocalDate(base);
  if (/昨天|昨日/.test(normalized)) return shiftDays(base, -1);
  if (/前天/.test(normalized)) return shiftDays(base, -2);
  if (/大前天/.test(normalized)) return shiftDays(base, -3);
  if (/明天/.test(normalized)) return shiftDays(base, 1);
  if (/后天/.test(normalized)) return shiftDays(base, 2);
  if (/大后天/.test(normalized)) return shiftDays(base, 3);

  let m = normalized.match(/(\d{4})[年\/.-](\d{1,2})[月\/.-](\d{1,2})[日号]?/);
  if (m) {
    const hit = safeDate(Number(m[1]), Number(m[2]), Number(m[3]));
    if (hit) return hit;
  }

  m = normalized.match(/(\d{1,2})月(\d{1,2})[日号]/);
  if (m) {
    const hit = safeDate(base.getFullYear(), Number(m[1]), Number(m[2]));
    if (hit) return hit;
  }

  m = normalized.match(/上个月(\d{1,2})[日号]/);
  if (m) {
    const y = base.getMonth() === 0 ? base.getFullYear() - 1 : base.getFullYear();
    const mo = base.getMonth() === 0 ? 12 : base.getMonth();
    const hit = safeDate(y, mo, Number(m[1]));
    if (hit) return hit;
  }

  m = normalized.match(/下个月(\d{1,2})[日号]/);
  if (m) {
    const y = base.getMonth() === 11 ? base.getFullYear() + 1 : base.getFullYear();
    const mo = base.getMonth() === 11 ? 1 : base.getMonth() + 2;
    const hit = safeDate(y, mo, Number(m[1]));
    if (hit) return hit;
  }

  m = normalized.match(/(?<!\d)(\d{1,2})[日号](?!\d)/);
  if (m) {
    const hit = safeDate(base.getFullYear(), base.getMonth() + 1, Number(m[1]));
    if (hit) return hit;
  }

  return "";
};

const detectAutoSubmitIntent = (text: string): boolean => {
  if (!text) return false;
  const normalized = text.replace(/\s+/g, "");
  const deny = /(需要确认|先确认|请确认|别直接|不要直接|先看下|先看一眼)/;
  if (deny.test(normalized)) return false;
  const allow =
    /(直接写入|直接保存|直接记账|直接提交|直接入账|无需确认|不用确认|不要确认|免确认|自动保存|自动提交)/;
  return allow.test(normalized);
};

const normalizeBoolean = (value: any): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return ["true", "1", "yes", "y", "是"].includes(v);
  }
  return false;
};

const normalizeConfidence = (value: any): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(1, value));
  }
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.max(0, Math.min(1, n));
  }
  return 0;
};

const sanitizeName = (value: string): string => {
  return value
    .replace(/[，。；：,.!?！？]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 18);
};

const extractActionNameFromTranscript = (text: string): string => {
  if (!text) return "";
  const cleaned = text
    .replace(/\s+/g, "")
    .replace(/(今天|昨日|昨天|前天|大前天|明天|后天|大后天)/g, "")
    .replace(/\d{1,2}月\d{1,2}[日号]?/g, "")
    .replace(/\d{1,2}[日号]/g, "")
    .replace(/\d+(\.\d+)?(元|块|人民币|rmb)/gi, "")
    .replace(/(直接写入|直接保存|直接记账|直接提交|无需确认|不用确认|自动保存|自动提交)/g, "")
    .replace(/(微信|支付宝|银行卡|信用卡|现金|云闪付)/g, "")
    .replace(/(帮我|给我|我|记一笔|记账|记下|记录一下|记一下|入账|流水)/g, "")
    .replace(/[，。；：,.!?！？]/g, "");

  return cleaned.slice(0, 12).trim();
};

const includesByLooseText = (source: string, target: string): boolean => {
  const s = source.replace(/\s+/g, "");
  const t = target.replace(/\s+/g, "");
  return !!t && s.includes(t);
};

export default defineEventHandler(async (event) => {
  try {
    const userId = await getUserId(event);
    if (!userId) {
      return error("未登录或登录已失效");
    }

    const parts = await readMultipartFormData(event);
    if (!parts || parts.length === 0) {
      return error("请求体为空");
    }

    let audioBuffer: Buffer | null = null;
    let day = "";
    let bookId = "";

    for (const part of parts) {
      if (part.name === "audio" && part.data) {
        audioBuffer = Buffer.from(part.data);
      }
      if (part.name === "day" && part.data) {
        day = Buffer.from(part.data).toString("utf8");
      }
      if (part.name === "bookId" && part.data) {
        bookId = Buffer.from(part.data).toString("utf8");
      }
    }

    if (!bookId) {
      return error("账本ID不能为空");
    }
    if (!audioBuffer || audioBuffer.length === 0) {
      return error("音频为空");
    }

    const book = await prisma.book.findFirst({
      where: {
        bookId,
        userId,
      },
    });

    if (!book) {
      return error("账本不存在或无权访问");
    }

    const config = useRuntimeConfig();
    const xunfeiAppId = String(config.xunfeiAppId || "");
    const xunfeiApiKey = String(config.xunfeiApiKey || "");
    const xunfeiApiSecret = String(config.xunfeiApiSecret || "");
    const scApiKey = String(config.supercomputingApiKey || "");
    const scModel = String(config.supercomputingModel || "DeepSeek-R1-Distill-Qwen-7B");

    if (!scApiKey) {
      return error("超算平台 API Key 未配置");
    }

    const transcript = await transcribeAudioByXunfeiIat(audioBuffer, {
      appId: xunfeiAppId,
      apiKey: xunfeiApiKey,
      apiSecret: xunfeiApiSecret,
    });

    const fallbackDay = normalizeDate(
      day,
      new Date().toISOString().slice(0, 10)
    );

    const candidateIndustryTypes = await prisma.flow.findMany({
      where: { bookId },
      select: { industryType: true },
      distinct: ["industryType"],
      take: 100,
    });
    const candidatePayTypes = await prisma.flow.findMany({
      where: { bookId },
      select: { payType: true },
      distinct: ["payType"],
      take: 100,
    });

    const transcriptDay = parseDateFromTranscript(transcript, fallbackDay);
    const dayHint = transcriptDay || fallbackDay;

    const prompt = `请把以下中文记账语音转写内容，解析成记账草稿 JSON。

返回要求（必须是 JSON，不要 markdown）：
{
  "day": "YYYY-MM-DD",
  "flowType": "支出/收入/不计收支",
  "industryType": "字符串",
  "payType": "字符串",
  "money": 数字,
  "name": "2-10字，动作摘要短语",
  "description": "字符串",
  "autoSubmitIntent": true/false,
  "autoSubmitConfidence": 0到1之间的小数
}

约束：
1. day 无法判断时用 "${dayHint}"
2. flowType 无法判断时用 "${book.defaultFlowType || "支出"}"
3. money 必须是数字（元），例如 32.5
4. description 保留原句关键信息，简短即可
5. autoSubmitIntent 仅当用户明确表达“直接写入/无需确认”等意图时才为 true
6. autoSubmitConfidence 表示你对 autoSubmitIntent 的把握，范围 [0,1]
7. name 必须能在原文中找到依据，不得杜撰品牌/地点/人物
8. 不要返回其它字段

可参考历史类型（可选）：
- industryType: ${candidateIndustryTypes.map((i) => i.industryType).filter(Boolean).join("、") || "无"}
- payType: ${candidatePayTypes.map((i) => i.payType).filter(Boolean).join("、") || "无"}

原文：
${transcript}`;

    const llmRaw = await callSupercomputingAPI(prompt, scApiKey, {
      model: scModel,
      systemPrompt:
        "你是记账结构化助手。只输出 JSON，不要任何解释。",
    });
    const llmJson = extractJson(llmRaw);
    const ruleAutoSubmit = detectAutoSubmitIntent(transcript);
    const llmAutoSubmit = normalizeBoolean(llmJson.autoSubmitIntent);
    const llmAutoSubmitConfidence = normalizeConfidence(
      llmJson.autoSubmitConfidence
    );
    const autoSubmitRequested =
      ruleAutoSubmit && llmAutoSubmit && llmAutoSubmitConfidence >= 0.7;

    const parsedFlowType = FLOW_TYPES.has(String(llmJson.flowType))
      ? String(llmJson.flowType)
      : book.defaultFlowType || "支出";

    const draftFlow: VoiceDraftFlow = {
      day: transcriptDay || normalizeDate(llmJson.day, dayHint),
      flowType: parsedFlowType,
      industryType: String(llmJson.industryType || "").trim(),
      payType: String(llmJson.payType || "").trim() || (book.defaultPayType || ""),
      money: normalizeMoney(llmJson.money),
      attribution: book.defaultAttribution || "",
      name: "",
      description:
        String(llmJson.description || "").trim() || `语音记账：${transcript}`,
    };

    const llmName = sanitizeName(String(llmJson.name || ""));
    const fallbackName = sanitizeName(extractActionNameFromTranscript(transcript));
    draftFlow.name = includesByLooseText(transcript, llmName)
      ? llmName
      : fallbackName;

    return success({
      transcript,
      draftFlow,
      needConfirm: !draftFlow.money || !draftFlow.industryType,
      autoSubmitRequested,
      autoSubmitMeta: {
        ruleAutoSubmit,
        llmAutoSubmit,
        llmAutoSubmitConfidence,
      },
    });
  } catch (err: any) {
    console.error("语音记账解析失败:", err?.message || err);
    return error(`语音记账解析失败: ${err?.message || "未知错误"}`);
  }
});
