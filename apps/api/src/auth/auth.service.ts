import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.module.js';
import { AppConfig } from '../config/config.module.js';
import { Prisma } from '../generated/prisma/client.js';
import type { User } from '../generated/prisma/client.js';
import { PublicHttpError } from '../common/error.filter.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';
import {
  normalizeIdentity,
  type RegisterDto,
  type LoginDto,
} from './auth.dto.js';

export const safeUser = (user: User) => ({
  id: user.id,
  email: user.email,
  username: user.username,
  role: user.role,
});
export const digestRefresh = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
export const newRefreshToken = (): string =>
  randomBytes(32).toString('base64url');
const invalidRefresh = () =>
  new PublicHttpError(
    401,
    'INVALID_REFRESH_TOKEN',
    'Refresh session is invalid or expired.',
  );

@Injectable()
export class AuthService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AppConfig) private readonly config: AppConfig,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(TokenService) private readonly tokens: TokenService,
  ) {}

  private async lockUser(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<void> {
    // One lock order for login, rotation and revocation prevents logout-all races.
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${id}::uuid FOR UPDATE`;
  }

  private async session(
    tx: Prisma.TransactionClient,
    user: User,
    familyId: string = randomUUID(),
    expiresAt = new Date(
      Date.now() + this.config.values.refreshTtlSeconds * 1000,
    ),
  ) {
    const refreshToken = newRefreshToken();
    await tx.authSession.create({
      data: {
        userId: user.id,
        familyId,
        refreshTokenHash: digestRefresh(refreshToken),
        expiresAt,
      },
    });
    const accessToken = await this.tokens.issue(user.id, familyId);
    return {
      user: safeUser(user),
      accessToken,
      expiresIn: this.config.values.accessTtlSeconds,
      refreshToken,
      refreshExpiresAt: expiresAt,
    };
  }

  async register(input: RegisterDto) {
    const passwordHash = await this.passwords.hash(input.password);
    try {
      return await this.db.client.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: normalizeIdentity(input.email),
            username: normalizeIdentity(input.username),
            passwordHash,
          },
        });
        return this.session(tx, user);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const emailExists = await this.db.client.user.findUnique({
          where: { email: normalizeIdentity(input.email) },
          select: { id: true },
        });
        throw new PublicHttpError(
          409,
          emailExists ? 'EMAIL_ALREADY_EXISTS' : 'USERNAME_ALREADY_EXISTS',
          emailExists
            ? 'Email is already registered.'
            : 'Username is already registered.',
        );
      }
      throw error;
    }
  }

  async login(input: LoginDto) {
    const identity = normalizeIdentity(input.emailOrUsername);
    const user = await this.db.client.user.findFirst({
      where: { OR: [{ email: identity }, { username: identity }] },
    });
    const matches = await this.passwords.matches(
      input.password,
      user?.passwordHash,
    );
    if (!user || !matches || user.status !== 'ACTIVE')
      throw new PublicHttpError(
        401,
        'INVALID_CREDENTIALS',
        'Invalid credentials.',
      );
    return this.db.client.$transaction(async (tx) => {
      await this.lockUser(tx, user.id);
      const current = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      if (current.status !== 'ACTIVE')
        throw new PublicHttpError(
          401,
          'INVALID_CREDENTIALS',
          'Invalid credentials.',
        );
      await tx.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
      return this.session(tx, current);
    });
  }

  async refresh(token: string | undefined) {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw invalidRefresh();
    const hash = digestRefresh(token);
    const initial = await this.db.client.authSession.findUnique({
      where: { refreshTokenHash: hash },
    });
    if (!initial) throw invalidRefresh();
    const result = await this.db.client.$transaction(async (tx) => {
      await this.lockUser(tx, initial.userId);
      const row = await tx.authSession.findUniqueOrThrow({
        where: { id: initial.id },
        include: { user: true },
      });
      if (row.revokedAt) {
        if (row.rotatedAt)
          await tx.authSession.updateMany({
            where: { familyId: row.familyId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        return null; // Commit replay revocation before returning an error.
      }
      if (row.expiresAt <= new Date() || row.user.status !== 'ACTIVE')
        return null;
      await tx.authSession.update({
        where: { id: row.id },
        data: { revokedAt: new Date(), rotatedAt: new Date() },
      });
      return this.session(tx, row.user, row.familyId, row.expiresAt);
    });
    if (!result) throw invalidRefresh();
    return result;
  }

  async authenticate(accessToken: string) {
    const { userId, familyId } = await this.tokens.verify(accessToken);
    const session = await this.db.client.authSession.findFirst({
      where: {
        userId,
        familyId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { status: 'ACTIVE' },
      },
      include: { user: true },
    });
    if (!session)
      throw new PublicHttpError(
        401,
        'UNAUTHORIZED',
        'Authentication required.',
      );
    return { user: safeUser(session.user), familyId };
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return;
    const session = await this.db.client.authSession.findUnique({
      where: { refreshTokenHash: digestRefresh(token) },
    });
    if (!session) return;
    await this.db.client.$transaction(async (tx) => {
      await this.lockUser(tx, session.userId);
      await tx.authSession.updateMany({
        where: { familyId: session.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.db.client.$transaction(async (tx) => {
      await this.lockUser(tx, userId);
      await tx.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }
}
