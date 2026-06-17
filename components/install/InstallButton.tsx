"use client";

import { useCallback, useState } from "react";
import styles from "./InstallButton.module.css";
import { IosInstallGuide } from "./IosInstallGuide";
import { useInstallPrompt } from "./useInstallPrompt";

export function InstallButton() {
    const { mode, canInstall, promptInstall } = useInstallPrompt();
    const [showGuide, setShowGuide] = useState(false);

    const handleClick = useCallback(async () => {
        if (mode === "native") {
            await promptInstall();
        } else if (mode === "ios-guide") {
            setShowGuide(true);
        }
    }, [mode, promptInstall]);

    const handleClose = useCallback(() => setShowGuide(false), []);

    if (!canInstall) return null;

    return (
        <>
            <button type="button" className={styles.button} onClick={handleClick} aria-label="앱 설치">
                앱 설치
            </button>
            {showGuide && <IosInstallGuide onClose={handleClose} />}
        </>
    );
}
