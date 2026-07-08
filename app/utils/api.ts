import { Alert } from "./alert";
import type { Result, UserInfo } from "./model";
import { useSystemStore } from "./store";

const API_BASE_STORAGE_KEY = "cashbook.api.base";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const normalizeApiBase = (value?: string) => {
  const base = String(value || "").trim();
  return base ? trimTrailingSlash(base) : "";
};

const getNativePackageOrigin = () => {
  if (typeof window === "undefined") return "";

  try {
    const raw = window.NativeBridgeHost?.getPackageInfo?.();
    if (!raw) return "";

    const result = typeof raw === "string" ? JSON.parse(raw) : raw;
    const data = result?.data || {};
    const candidates = [data.source, data.entryUrl].filter(Boolean);
    const remoteUrl = candidates.find((item: string) => /^https?:\/\//.test(item));
    return remoteUrl ? new URL(remoteUrl).origin : "";
  } catch {
    return "";
  }
};

const getApiBase = () => {
  const runtimeConfig = useRuntimeConfig();
  const runtimeApiBase = normalizeApiBase(runtimeConfig.public.apiBase as string);
  if (runtimeApiBase) return runtimeApiBase;

  if (typeof window !== "undefined") {
    const storedApiBase = normalizeApiBase(
      localStorage.getItem(API_BASE_STORAGE_KEY) || ""
    );
    if (storedApiBase) return storedApiBase;

    const nativeOrigin = normalizeApiBase(getNativePackageOrigin());
    if (nativeOrigin) return nativeOrigin;
  }

  return "";
};

const getApiUrl = (path: string) => {
  const cleanPath = path.replace(/^\/+/, "");
  const apiBase = getApiBase();
  return apiBase ? `${apiBase}/${cleanPath}` : `/${cleanPath}`;
};

// 调用后端接口统一封装，节省Header处理
export const doApi = {
  // get 常用于获取公开数据
  get: async <T>(path: string, query?: any): Promise<T> => {
    const res = await $fetch<Result<T>>(getApiUrl(path), {
      method: "GET",
      query: query,
      headers: getHeaders(),
      credentials: "include",
    });

    return intercepterResponse(res);
  },
  // post 用于大部分业务接口调用
  post: async <T>(path: string, data?: any): Promise<T> => {
    const res = await $fetch<Result<T>>(getApiUrl(path), {
      method: "POST",
      headers: {
        ...getHeaders(),
        "Content-Type": "application/json;chartset=utf-8",
      },
      body: data,
      credentials: "include",
    });
    return intercepterResponse(res);
  },

  // postform 常用于上传文件
  postform: async <T>(path: string, data: FormData): Promise<T> => {
    // const formData = new FormData();
    // for (let key in data) {
    //   formData.append(key, data[key]);
    // }
    const res = await $fetch<Result<T>>(getApiUrl(path), {
      method: "POST",
      // postform 使用默认header，如果有问题，建议自行尝试添加 'Content-Type': 'multipart/form-data'
      headers: getHeaders(),
      body: data,
    });
    return intercepterResponse(res);
  },

  // download 常用于获取文件，返回结果一般是文件流，常用于实现下载文件、展示图片等功能
  download: async (path: string, query?: any): Promise<any> => {
    return await $fetch(getApiUrl(path), {
      method: "GET",
      query: query,
      responseType: "blob",
      headers: getHeaders(),
    });
  },
};

const intercepterResponse = <T>(res: Result<T>): T => {
  if (res.c == 200) {
    return res.d;
  } else {
    if (res.c == 400) {
      // 清除登陆状态（@sidebase/nuxt-auth框架）
      // useAuth().signOut();
      const route = useRoute();
      const isMobileRoute = route.path === "/m" || route.path.startsWith("/m/");
      const loginPath =
        isMobileRoute ||
        (typeof window !== "undefined" && getUiMode() === "mobile-v2")
          ? "/m/login"
          : "/login";
      navigateTo({
        path: loginPath,
        query: { callbackUrl: route.fullPath },
      });
    }
    Alert.error(res.m);
    throw Error(res.m);
  }
};

const getStoredAuthorization = () => {
  if (typeof window === "undefined") {
    return "";
  }

  return localStorage.getItem("Authorization") || "";
};

const getHeaders = () => {
  return {
    Authorization: useCookie("Authorization").value || getStoredAuthorization(),
    Admin: useCookie("Admin").value || "",
  };
};

export const getUserInfo = async () => {
  try {
    const systemStore = useSystemStore();
    const user = await doApi.get<UserInfo>("api/entry/user/info");

    if (user) {
      systemStore.setGlobalUserInfo(user);
      return user;
    } else {
      systemStore.setGlobalUserInfo(null);
      return null;
    }
  } catch (e) {
    const systemStore = useSystemStore();
    systemStore.setGlobalUserInfo(null);
    return null;
  }
};
