import crypto from "crypto";

interface XunfeiWsResponse {
  code?: number;
  message?: string;
  data?: {
    status?: number;
    result?: any;
  };
}

const buildAuthUrl = (apiKey: string, apiSecret: string): string => {
  const host = "iat-api.xfyun.cn";
  const path = "/v2/iat";
  const date = new Date().toUTCString();
  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
  const signature = crypto
    .createHmac("sha256", apiSecret)
    .update(signatureOrigin)
    .digest("base64");
  const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
  const authorization = Buffer.from(authorizationOrigin).toString("base64");

  const query = new URLSearchParams({
    authorization,
    date,
    host,
  });
  return `wss://${host}${path}?${query.toString()}`;
};

const parseWords = (result: any): string => {
  if (!result || !Array.isArray(result.ws)) return "";
  return result.ws
    .map((ws: any) => {
      if (!Array.isArray(ws?.cw)) return "";
      return ws.cw.map((cw: any) => cw?.w || "").join("");
    })
    .join("");
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const sendAudioFrames = async (ws: WebSocket, audioBuffer: Buffer, appId: string) => {
  const frameSize = 1280;
  const format = "audio/L16;rate=16000";

  if (audioBuffer.length <= frameSize) {
    ws.send(
      JSON.stringify({
        common: { app_id: appId },
        business: {
          language: "zh_cn",
          domain: "iat",
          accent: "mandarin",
          vad_eos: 6000,
        },
        data: {
          status: 2,
          format,
          encoding: "raw",
          audio: audioBuffer.toString("base64"),
        },
      })
    );
    return;
  }

  let offset = 0;
  let status = 0;
  while (offset < audioBuffer.length) {
    const end = Math.min(offset + frameSize, audioBuffer.length);
    const chunk = audioBuffer.subarray(offset, end);
    const isLast = end >= audioBuffer.length;
    const payload: any = {
      data: {
        status: isLast ? 2 : status,
        format,
        encoding: "raw",
        audio: chunk.toString("base64"),
      },
    };

    if (status === 0) {
      payload.common = { app_id: appId };
      payload.business = {
        language: "zh_cn",
        domain: "iat",
        accent: "mandarin",
        vad_eos: 6000,
      };
    }

    ws.send(JSON.stringify(payload));
    offset = end;
    status = 1;
    await sleep(40);
  }
};

export const transcribeAudioByXunfeiIat = async (
  audioBuffer: Buffer,
  config: {
    appId: string;
    apiKey: string;
    apiSecret: string;
  }
): Promise<string> => {
  const { appId, apiKey, apiSecret } = config;
  if (!appId || !apiKey || !apiSecret) {
    throw new Error(
      "讯飞语音配置缺失，请检查 NUXT_XUNFEI_APP_ID / NUXT_XUNFEI_API_KEY / NUXT_XUNFEI_API_SECRET"
    );
  }
  if (!audioBuffer || audioBuffer.length === 0) {
    throw new Error("音频为空");
  }

  const url = buildAuthUrl(apiKey, apiSecret);

  return await new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let transcript = "";
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      try {
        ws.close();
      } catch {}
      reject(new Error("讯飞识别超时"));
    }, 25000);

    ws.onopen = async () => {
      try {
        await sendAudioFrames(ws, audioBuffer, appId);
      } catch (err: any) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        ws.close();
        reject(new Error(err?.message || "发送音频帧失败"));
      }
    };

    ws.onmessage = (evt) => {
      if (done) return;
      try {
        const res = JSON.parse(String(evt.data || "{}")) as XunfeiWsResponse;
        if ((res.code || 0) !== 0) {
          done = true;
          clearTimeout(timer);
          ws.close();
          reject(new Error(`讯飞识别失败: ${res.message || res.code}`));
          return;
        }

        transcript += parseWords(res.data?.result);

        if (res.data?.status === 2) {
          done = true;
          clearTimeout(timer);
          ws.close();
          const text = transcript.trim();
          if (!text) {
            reject(new Error("讯飞识别成功但未返回可用文本"));
            return;
          }
          resolve(text);
        }
      } catch (err: any) {
        done = true;
        clearTimeout(timer);
        ws.close();
        reject(new Error(`讯飞返回解析失败: ${err?.message || "未知错误"}`));
      }
    };

    ws.onerror = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      reject(new Error("讯飞 WebSocket 连接失败"));
    };

    ws.onclose = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      reject(new Error("讯飞连接提前关闭"));
    };
  });
};

