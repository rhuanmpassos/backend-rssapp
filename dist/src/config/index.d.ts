export declare const isDevelopment: boolean;
export declare const isProduction: boolean;
export declare function getDatabaseUrl(): string;
export declare const config: {
    isDevelopment: boolean;
    isProduction: boolean;
    databaseUrl: string;
    port: number;
    jwtSecret: string;
    jwtExpiresIn: string;
    redisUrl: string | undefined;
    redisToken: string | undefined;
    youtubeApiKey: string | undefined;
    expoAccessToken: string | undefined;
};
export default config;
