export const MOBILE_OTP_DELIVERY = Symbol("MOBILE_OTP_DELIVERY");

export interface MobileOtpDelivery {
  sendLoginCode(input: {
    recipientEmail: string;
    recipientName: string;
    code: string;
    expiresInMinutes: 5;
  }): Promise<void>;
}
