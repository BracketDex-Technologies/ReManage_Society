import { Injectable } from "@nestjs/common";
import nodemailer from "nodemailer";
import type { MobileOtpDelivery } from "./mobile-otp-delivery.ts";

interface MobileOtpMailMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
}

interface MobileOtpMailTransport {
  sendMail(message: MobileOtpMailMessage): Promise<unknown>;
}

interface MobileOtpMailEnvironment {
  SMTP_URL?: string;
  EMAIL_FROM?: string;
}

export type MobileOtpMailTransportFactory = (
  smtpUrl: string,
) => MobileOtpMailTransport;

@Injectable()
export class SmtpMobileOtpDeliveryService implements MobileOtpDelivery {
  constructor(
    private readonly source: MobileOtpMailEnvironment = process.env,
    private readonly createTransport: MobileOtpMailTransportFactory = (smtpUrl) =>
      nodemailer.createTransport(smtpUrl),
  ) {}

  async sendLoginCode(input: {
    recipientEmail: string;
    recipientName: string;
    code: string;
    expiresInMinutes: 5;
  }): Promise<void> {
    const smtpUrl = this.source.SMTP_URL?.trim();
    const from = this.source.EMAIL_FROM?.trim();
    if (!smtpUrl || !from) {
      throw new Error("Mobile OTP email delivery is not configured");
    }

    await this.createTransport(smtpUrl).sendMail({
      from,
      to: input.recipientEmail,
      subject: "Your ReManage login code",
      text: `Hello ${input.recipientName},\n\nYour ReManage login code is ${input.code}. It expires in five minutes.\n`,
    });
  }
}
