export type Tab = { units: number; drinks: number; isHungover?: boolean; kind?: number; messages?: number }

declare module 'claude-code' {
  interface PluginState {
    'pair-drinking': { tab: Shaped<Tab> }
  }
}
