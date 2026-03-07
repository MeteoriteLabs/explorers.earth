import nodemailer from 'nodemailer';
import crypto from 'crypto';

// Configure email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

export async function sendOTP(email: string, otp: string) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Cosmic Admin Login OTP',
    html: `
      <h1>Cosmic Admin Login</h1>
      <p>Your OTP for login is: <strong>${otp}</strong></p>
      <p>This OTP will expire in 5 minutes.</p>
    `
  };

  await transporter.sendMail(mailOptions);
}

export function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
