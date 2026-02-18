import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { isEmailConfigured, sendPasswordResetEmail } from '../services/email.service';

const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const FRONTEND_URL = process.env.FRONTEND_URL || process.env.FRONTEND_APP_URL || 'http://localhost:3000';

const MIN_PASSWORD_LENGTH = 6;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email: unknown): string | null {
  if (typeof email !== 'string' || !email.trim()) return 'Email is required';
  if (!EMAIL_REGEX.test(email.trim())) return 'Invalid email format';
  return null;
}

function validatePassword(password: unknown, fieldLabel = 'Password'): string | null {
  if (password == null || (typeof password === 'string' && !password)) return `${fieldLabel} is required`;
  if (typeof password !== 'string') return `${fieldLabel} must be a string`;
  if (password.length < MIN_PASSWORD_LENGTH) return `${fieldLabel} must be at least ${MIN_PASSWORD_LENGTH} characters`;
  return null;
}

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, name } = req.body;

    const emailError = validateEmail(email);
    if (emailError) {
      res.status(400).json({ error: emailError });
      return;
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      res.status(400).json({ error: passwordError });
      return;
    }
    const normalizedEmail = (email as string).trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      res.status(400).json({ error: 'User already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password as string, 10);

    const user = await prisma.user.create({
      data: { email: normalizedEmail, passwordHash, name: name != null ? String(name).trim() || undefined : undefined },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' } as jwt.SignOptions
    );

    res.status(201).json({ user, token });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    const emailError = validateEmail(email);
    if (emailError) {
      res.status(400).json({ error: emailError });
      return;
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      res.status(400).json({ error: passwordError });
      return;
    }
    const normalizedEmail = (email as string).trim().toLowerCase();

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' } as jwt.SignOptions
    );

    res.json({
      user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}

export async function getMe(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error('getMe error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
}

function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  try {
    const { email } = req.body;

    const emailError = validateEmail(email);
    if (emailError) {
      res.status(400).json({ error: emailError });
      return;
    }
    const normalizedEmail = (email as string).trim().toLowerCase();

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      res.status(200).json({
        message: 'If an account exists with this email, you will receive a password reset link.',
      });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashResetToken(token);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: expiresAt,
      },
    });

    const resetLink = `${FRONTEND_URL.replace(/\/$/, '')}/reset-password?token=${token}`;

    const useEmail = isEmailConfigured();
    if (useEmail) {
      const { ok, error: sendError } = await sendPasswordResetEmail(user.email, resetLink);
      if (!ok) {
        console.error('Failed to send reset email:', sendError);
        res.status(500).json({ error: 'Failed to send reset email. Please try again later.' });
        return;
      }
    }

    const payload: { message: string; resetLink?: string } = {
      message: 'If an account exists with this email, you will receive a password reset link.',
    };
    if (!useEmail) payload.resetLink = resetLink;

    res.status(200).json(payload);
  } catch (error) {
    console.error('forgotPassword error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const { token, newPassword } = req.body;

    if (typeof token !== 'string' || !token.trim()) {
      res.status(400).json({ error: 'Reset token is required' });
      return;
    }
    const passwordError = validatePassword(newPassword, 'New password');
    if (passwordError) {
      res.status(400).json({ error: passwordError });
      return;
    }

    const tokenHash = hashResetToken(token.trim());
    const now = new Date();

    const user = await prisma.user.findFirst({
      where: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: { gt: now },
      },
    });

    if (!user) {
      res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword as string, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      },
    });

    res.status(200).json({ message: 'Password has been reset. You can now sign in.' });
  } catch (error) {
    console.error('resetPassword error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
}
