/** Only cash on delivery — no payment gateway */
export const PAYMENT_METHODS = ["cash"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const CASH_PAYMENT_LABEL = "Cash on Delivery (COD)";
