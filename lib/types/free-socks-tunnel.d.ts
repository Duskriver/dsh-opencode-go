export declare function openSocksTunnel(raw: string, signal: AbortSignal): Promise<{
    url: string;
    close(): Promise<void>;
}>;
