export type Mistake = { mistake: string; correction: string; isCaught: boolean }

export type Tab = {
  units: number
  drinks: number
  isHungover?: boolean
  // The bar is open in this session: set by the first drink, plate or /bar, cleared by /sober.
  isOpen?: boolean
  kind?: number
  messages?: number
  // How much the food eaten so far will soften the next drink.
  lining?: number
  // What was served tonight, by name.
  order?: Record<string, number>
  snacks?: Record<string, number>
  // The highest the tab got tonight.
  peak?: number
  // The mistakes Claude hid in its replies and whether the person caught them.
  mistakes?: Mistake[]
}

declare module 'claude-code' {
  interface PluginState {
    'pair-drinking': { tab: Shaped<Tab> }
  }
}
