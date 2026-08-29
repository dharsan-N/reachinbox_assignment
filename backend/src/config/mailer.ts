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
    console.log('Generating Ethereal SMTP test account automatically...');
    const testAccount = await nodemailer.createTestAccount();
    user = testAccount.user;
    pass = testAccount.pass;
    etherealAccountInfo = { user, pass };
    console.log(`Ethereal Test Account generated: ${user}`);
  } else {
    etherealAccountInfo = { user, pass };
  }

  etherealTransporterInstance = nodemailer.createTransport({
    host: config.ethereal.host,
    port: config.ethereal.port,
    secure: false,
    auth: {
      user,
      pass,
    },
  });

  return etherealTransporterInstance;
}

export async function getMailerTransporter(): Promise<nodemailer.Transporter> {
  return getEtherealTransporter();
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
