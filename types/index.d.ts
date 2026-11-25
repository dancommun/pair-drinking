export type Tab = { units: number; drinks: number; isHungover?: boolean; kind?: number; messages?: number }

declare module 'claude-code' {
  interface PluginState {
    'drunk-bar': { tab: Shaped<Tab> }
  }
}
