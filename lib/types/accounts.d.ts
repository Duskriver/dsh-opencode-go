/** Serialized account commands, primary selection and official quota reads. */
import { type SettingsWriteResult, type GoAccountSwitch, type AccountCommand, type GoUsage } from './contracts.ts';
import { type CredentialProvider } from '@deepseek-ai/dsh-credentials';
import type { GoAccountSettlement } from './adapter.ts';
import { type OpencodeGoConfig } from './config.ts';
import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { ProxyTransport } from './transport.ts';
export interface AccountSettingsWriter {
    describe(): readonly {
        ns: string;
        revision: number;
        value: unknown;
    }[];
    mutate(ns: string, ops: readonly {
        op: 'set';
        path: string[];
        value: unknown;
    }[], expectedRevision?: number): Promise<unknown>;
}
/** Locate the profile entry that owns this mount's account metadata. */
export declare function accountSettingsRow(settings: AccountSettingsWriter): {
    ns: string;
    revision: number;
    value: unknown;
} | undefined;
export interface AttemptOutcome {
    failure?: {
        code: string;
    };
    emitted: boolean;
    totalTokens: number;
    aborted: boolean;
    hasNext: boolean;
}
/** Switching accounts must never replay output, charged work or model permission failures. */
export declare function accountFallback(outcome: AttemptOutcome): GoAccountSwitch['reason'] | undefined;
/** Only credential, rate and quota failures cool down a key; PERMISSION_DENIED is model-scoped. */
export declare function isGatewayKeyRejection(failure: {
    code: string;
}): boolean;
type AccountCredentials = Pick<CredentialProvider, 'describe' | 'resolve' | 'set' | 'unset'>;
/** One mount serializes account edits, credential writes and fallback promotion in memory. */
export declare class GoAccountManager {
    private readonly config;
    private readonly logger;
    private connection;
    private queue;
    private generation;
    private signature;
    private credentialGeneration;
    private latestSeq;
    private notice;
    constructor(config: () => OpencodeGoConfig, logger: {
        warn(message: string): void;
    });
    connect(settings: AccountSettingsWriter, credentials: AccountCredentials): () => void;
    private enqueue;
    private read;
    private write;
    execute(raw: AccountCommand): Promise<SettingsWriteResult>;
    private executeCommand;
    /** A freshness fence prevents an old request from overriding a later user choice. */
    capture(): number;
    credentialChanged(): void;
    lastSwitch(): GoAccountSwitch | undefined;
    settle(event: GoAccountSettlement): void;
}
/** The browser sends commands; the host owns credentials and metadata writes. */
export declare class GoAccountsService extends TypertRemoteService {
    private readonly options;
    constructor(ctx: Context, options: {
        manager: GoAccountManager;
    });
    execute(command: AccountCommand): Promise<SettingsWriteResult>;
}
interface UsageOptions {
    baseURL: () => string;
    proxyURL?: () => string;
    transport?: ProxyTransport;
    resolveApiKey: (ref?: string) => Promise<string | undefined>;
    activeRef?: () => string;
    accountRefs?: () => readonly string[];
    lastSwitch?: () => GoAccountSwitch | undefined;
}
/** Account statistics are fetched on the Host; credentials never enter the browser. */
export declare class GoUsageService extends TypertRemoteService {
    private readonly options;
    private readonly identities;
    private readonly pending;
    private readonly transport;
    constructor(ctx: Context, options: UsageOptions);
    read(): Promise<GoUsage>;
    readAccount(ref: string): Promise<GoUsage>;
    private readRef;
    private fetchUsage;
}
export {};
