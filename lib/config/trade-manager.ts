export const tradeManagerConfig = {
  source: "manual-10k-risk-plan-v1",
  accountEquityNok: 10_000,
  riskPercent: 1.5,
  maxRiskPercent: 2,
  maxNotionalLeverage: 5,
  partialTakeProfitR: 2,
  partialClosePercent: 50,
} as const;