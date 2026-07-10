export type PaymentMethodType = "bank" | "e_wallet" | "other";

export type PaymentMethod = {
  id: string;
  method_type: PaymentMethodType;
  provider_name: string;
  account_name: string;
  account_number: string | null;
  qr_image_url: string | null;
  instructions: string | null;
  is_active: boolean;
  sort_order: number;
};

export type PaymentMethodPublic = Pick<
  PaymentMethod,
  | "id"
  | "method_type"
  | "provider_name"
  | "account_name"
  | "account_number"
  | "qr_image_url"
  | "instructions"
  | "sort_order"
>;

export function methodTypeLabel(type: PaymentMethodType | string): string {
  switch (type) {
    case "bank":
      return "Bank";
    case "e_wallet":
      return "E-wallet";
    default:
      return "Other";
  }
}
