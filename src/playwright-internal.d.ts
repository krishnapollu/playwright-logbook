declare module 'playwright/lib/common' {
  export const configLoader: {
    loadConfigFromFile(directory: string): Promise<{ config: { configFile?: string; reporter: unknown } }>;
  };
}
