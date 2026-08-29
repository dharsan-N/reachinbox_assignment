import nodemailer from 'nodemailer';
import { config } from './env';

let etherealTransporterInstance: nodemailer.Transporter | null = null;
let etherealAccountInfo: { user: string; pass: string } | null = null;

export async function getEtherealTransporter(): Promise<nodemailer.Transporter> {
  if (etherealTransporterInstance) {
    return etherealTransporterInstance;
  }

  let user = config.ethereal.user;
  let pass = config.ethereal.pass;

  if (!user || !pass) {
    try {
      console.log('Generating Ethereal SMTP test account automatically...');
      const testAccount = await Promise.race([
        nodemailer.createTestAccount(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Ethereal test account generation timed out')), 6000)
        ),
      ]);
      user = testAccount.user;
      pass = testAccount.pass;
      etherealAccountInfo = { user, pass };
      console.log(`Ethereal Test Account generated: ${user}`);
    } catch (err: any) {
      console.warn(`[Mailer] Ethereal account generation notice: ${err.message}. Using demo credentials.`);
      user = 'demo.scheduler@ethereal.email';
      pass = 'demo_scheduler_pass_123';
      etherealAccountInfo = { user, pass };
    }
  } else {
    etherealAccountInfo = { user, pass };
  }

  try {
    etherealTransporterInstance = nodemailer.createTransport({
      host: config.ethereal.host || 'smtp.ethereal.email',
      port: config.ethereal.port || 587,
      secure: config.ethereal.port === 465,
      auth: {
        user,
        pass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  } catch (err: any) {
    console.warn('[Mailer] Using JSON fallback transport:', err.message);
    etherealTransporterInstance = nodemailer.createTransport({
      jsonTransport: true,
    });
  }

  return etherealTransporterInstance;
}

export async function getMailerTransporter(): Promise<nodemailer.Transporter> {
  try {
    return await getEtherealTransporter();
  } catch (err: any) {
    console.warn('[Mailer] Mailer initialization notice:', err.message);
    etherealTransporterInstance = nodemailer.createTransport({ jsonTransport: true });
    return etherealTransporterInstance;
  }
}

export async function getTransporterForSender(
  userId: string,
  senderEmail: string
): Promise<{ transporter: nodemailer.Transporter; isRealGmail: boolean }> {
  // 1. If explicit custom SMTP is configured in .env (e.g. Gmail App Password)
  if (config.smtp.host && config.smtp.user && config.smtp.pass) {
    console.log(`[Mailer] Using configured SMTP server: ${config.smtp.host}`);
    const smtpTransporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    return { transporter: smtpTransporter, isRealGmail: true };
  }

  // 2. Default to Ethereal SMTP (as required by ReachInbox assignment)
  const ethereal = await getEtherealTransporter();
  return { transporter: ethereal, isRealGmail: false };
}

export function getEtherealCredentials() {
  return etherealAccountInfo;
}

