declare function extractChannelId(html: string, handle: string): Promise<{
    id: string | null;
    details: string;
}>;
declare function testChannel(handle: string, expectedId: string): Promise<void>;
declare function main(): Promise<void>;
