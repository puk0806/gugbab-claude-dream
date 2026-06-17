export function detectStandalone(): boolean {
    if (typeof window === "undefined") return false;
    if (typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches) {
        return true;
    }
    const navAny = window.navigator as Navigator & { standalone?: boolean };
    return navAny.standalone === true;
}

export function detectIOSSafari(): boolean {
    if (typeof window === "undefined") return false;
    const ua = window.navigator.userAgent;
    return /iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}
