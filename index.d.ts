import type { Express, Request, Response } from 'express';

export type SupportedToken = 'USDC' | 'ETH' | 'USD' | 'AUD' | string;

export interface PaymentMandate {
  from: string;
  permissions: unknown;
  signature: string;
}

export interface PaymentRequestPayload {
  from: string;
  amount: number | string;
  token: SupportedToken;
  description?: string;
  mandate?: PaymentMandate;
}

export interface PaymentCallbackPayload {
  paymentId: string;
  amount: number;
  currency: string;
  from?: string;
  status: 'completed';
}

export interface AgentPaymentOptions {
  wallet: string;
  acceptedTokens?: SupportedToken[];
  stripeSecretKey?: string;
  webhookSecret?: string;
  onPayment?: (payment: PaymentCallbackPayload) => void | Promise<void>;
}

export declare class AgentPayment {
  constructor(options?: AgentPaymentOptions);
  wallet: string;
  acceptedTokens: SupportedToken[];
  webhookSecret?: string;
  app: Express;
  setupRoutes(): void;
  handlePaymentRequest(req: Request, res: Response): Promise<Response | undefined>;
  handleWebhook(req: Request, res: Response): Promise<Response | undefined>;
  generatePaymentCard(req: Request, res: Response): Promise<Response | undefined>;
  getRevenue(req: Request, res: Response): Promise<Response | undefined>;
  verifyMandate(mandate: PaymentMandate): boolean;
  convertToMinorUnits(amount: number | string, currency: string): number;
  getStripeCurrency(token: SupportedToken): string | null;
  normalizeToken(token: SupportedToken): string;
  isPositiveAmount(amount: number | string): boolean;
  middleware(): Express;
}
