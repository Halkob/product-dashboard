import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken, parseExpiryMs, TokenPayload } from '../auth/tokens';

const payload: TokenPayload = { userId: 1, email: 'test@example.com', role: 'CEO' };

describe('Token utilities', () => {
  describe('signAccessToken / verifyAccessToken', () => {
    it('should sign and verify an access token', () => {
      const token = signAccessToken(payload);
      const decoded = verifyAccessToken(token);
      expect(decoded.userId).toBe(1);
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.role).toBe('CEO');
    });

    it('should throw when verifying an invalid access token', () => {
      expect(() => verifyAccessToken('invalid.token.here')).toThrow();
    });
  });

  describe('signRefreshToken / verifyRefreshToken', () => {
    it('should sign and verify a refresh token', () => {
      const token = signRefreshToken(payload);
      const decoded = verifyRefreshToken(token);
      expect(decoded.userId).toBe(1);
      expect(decoded.role).toBe('CEO');
    });

    it('should throw when verifying an invalid refresh token', () => {
      expect(() => verifyRefreshToken('bad-token')).toThrow();
    });
  });

  describe('parseExpiryMs', () => {
    it('should parse seconds', () => expect(parseExpiryMs('30s')).toBe(30_000));
    it('should parse minutes', () => expect(parseExpiryMs('15m')).toBe(900_000));
    it('should parse hours', () => expect(parseExpiryMs('1h')).toBe(3_600_000));
    it('should parse days', () => expect(parseExpiryMs('7d')).toBe(604_800_000));
    it('should throw on invalid format', () => expect(() => parseExpiryMs('abc')).toThrow());
  });
});
