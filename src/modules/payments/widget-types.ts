export type WidgetOptions = {
  publicKey: string;
  currency: "COP";
  amountInCents: number;
  reference: string;
  signature: { integrity: string };
  expirationTime: string;
  bootstrapTransport: "postmessage";
};
declare global {
  interface Window {
    WidgetCheckout?: new (options: WidgetOptions) => {
      open(callback: (result: { transaction?: { id?: string } }) => void): void;
    };
  }
}
