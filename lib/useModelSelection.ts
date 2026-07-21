// 클라이언트 전용 — SSR에서 호출하지 않는다.
import { useEffect, useState } from "react";
import type { ModelInfo, ModelsResponse } from "./types";

const MODEL_STORAGE_KEY = "gugbab-dream:model";
const FALLBACK_MODEL = "sonnet";

function loadStoredModel(): string {
    if (typeof window === "undefined") return FALLBACK_MODEL;
    try {
        return window.localStorage.getItem(MODEL_STORAGE_KEY) ?? FALLBACK_MODEL;
    } catch {
        return FALLBACK_MODEL;
    }
}

export interface UseModelSelectionReturn {
    /** relay가 제공하는 모델 목록 — 로드 전에는 null */
    readonly models: ModelInfo[] | null;
    readonly model: string;
    readonly selectModel: (alias: string) => void;
}

export function useModelSelection(): UseModelSelectionReturn {
    const [models, setModels] = useState<ModelInfo[] | null>(null);
    const [model, setModel] = useState<string>(loadStoredModel);

    useEffect(() => {
        let cancelled = false;
        async function loadModels() {
            try {
                const res = await fetch("/api/models");
                if (!res.ok) return;
                const data = (await res.json()) as ModelsResponse;
                if (cancelled) return;
                setModels(data.models);
                // 저장된 alias가 폐기됐으면 relay 기본값으로 폴백
                setModel((prev) => (data.models.some((m) => m.alias === prev) ? prev : data.default));
            } catch {
                // 미로드 시 모델 미전달 — relay 기본값에 위임
            }
        }
        loadModels();
        return () => {
            cancelled = true;
        };
    }, []);

    const selectModel = (alias: string) => {
        setModel(alias);
        try {
            localStorage.setItem(MODEL_STORAGE_KEY, alias);
        } catch {
            // localStorage 불가 환경 — 세션 내 상태로만 유지
        }
    };

    return { models, model, selectModel };
}
