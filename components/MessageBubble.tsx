import type { ChatMessage } from "@/lib/types";
import styles from "./MessageBubble.module.css";

interface MessageBubbleProps {
    message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
    const isUser = message.role === "user";
    return (
        <div className={`${styles.bubble} ${isUser ? styles.user : styles.ai}`}>
            {!isUser && <div className={styles.avatar}>💭</div>}
            <div className={styles.content}>{message.content}</div>
        </div>
    );
}
