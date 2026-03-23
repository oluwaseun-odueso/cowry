import { Request, Response, NextFunction } from 'express';
import { body, query, validationResult, ValidationChain } from 'express-validator';

export class ValidationMiddleware {
  /**
   * Validate request against validation rules
   */
  static validate = (validations: ValidationChain[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Run all validations
      await Promise.all(validations.map(validation => validation.run(req)));

      const errors = validationResult(req);
      if (errors.isEmpty()) {
        return next();
      }

      res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array().map(err => ({
          field: err.type === 'field' ? err.path : 'unknown',
          message: err.msg
        }))
      });
    };
  };

  /**
   * Registration validation rules
   */
  static registerRules: ValidationChain[] = [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    
    body('firstName')
      .notEmpty()
      .withMessage('First name is required')
      .isLength({ max: 50 })
      .withMessage('First name cannot exceed 50 characters')
      .matches(/^[A-Za-z\s\-']+$/)
      .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),
    
    body('lastName')
      .notEmpty()
      .withMessage('Last name is required')
      .isLength({ max: 50 })
      .withMessage('Last name cannot exceed 50 characters')
      .matches(/^[A-Za-z\s\-']+$/)
      .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),
    
    body('phoneNumber')
      .notEmpty()
      .withMessage('Phone number is required')
      .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,4}[-\s.]?[0-9]{1,4}$/)
      .withMessage('Please provide a valid phone number')
  ];

  /**
   * Login validation rules
   */
  static loginRules: ValidationChain[] = [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ];

  /**
   * Refresh token validation rules
   */
  static refreshTokenRules: ValidationChain[] = [
    body('refreshToken')
      .notEmpty()
      .withMessage('Refresh token is required')
  ];

  /**
   * Forgot password validation rules
   */
  static forgotPasswordRules: ValidationChain[] = [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address')
  ];

  /**
   * Reset password validation rules
   */
  static resetPasswordRules: ValidationChain[] = [
    body('token')
      .notEmpty()
      .withMessage('Reset token is required'),
    
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    
    body('confirmPassword')
      .custom((value, { req }) => value === req.body.password)
      .withMessage('Passwords do not match')
  ];

  /**
   * Change password validation rules
   */
  static changePasswordRules: ValidationChain[] = [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters long')
      .matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
      .custom((value, { req }) => value !== req.body.currentPassword)
      .withMessage('New password must be different from current password')
  ];

  /**
   * Verify email — accepts the plain-text token from the verification link
   */
  static verifyEmailRules: ValidationChain[] = [
    body('token')
      .notEmpty().withMessage('Verification token is required')
      .isLength({ min: 64, max: 64 }).withMessage('Invalid verification token'),
  ];

  /**
   * Enable MFA — confirm setup with first TOTP code
   */
  static enableMfaRules: ValidationChain[] = [
    body('code')
      .notEmpty().withMessage('Authenticator code is required')
      .matches(/^\d{6}$/).withMessage('Code must be a 6-digit number')
  ];

  /**
   * Verify MFA challenge during login (challengeToken + TOTP or backup code)
   */
  static verifyMfaRules: ValidationChain[] = [
    body('challengeToken')
      .notEmpty().withMessage('Challenge token is required'),
    body('code')
      .notEmpty().withMessage('MFA code is required')
      .matches(/^(\d{6}|[A-F0-9]{8})$/).withMessage('Code must be a 6-digit TOTP or 8-character backup code')
  ];

  /**
   * Disable MFA — requires current TOTP or a backup code
   */
  static disableMfaRules: ValidationChain[] = [
    body('code')
      .notEmpty().withMessage('Code is required')
      .matches(/^(\d{6}|[A-F0-9]{8})$/).withMessage('Code must be a 6-digit TOTP or 8-character backup code')
  ];

  static createAccountRules: ValidationChain[] = [
    body('type')
      .notEmpty().withMessage('Account type is required')
      .isIn(['savings', 'current']).withMessage('Account type must be savings or current'),
    body('currency')
      .optional()
      .isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter code')
      .isAlpha().withMessage('Currency must contain only letters'),
  ];

  static depositRules: ValidationChain[] = [
    body('amount')
      .notEmpty().withMessage('Amount is required')
      .isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
    body('description')
      .optional()
      .isString().trim()
      .isLength({ max: 255 }).withMessage('Description cannot exceed 255 characters'),
  ];

  static withdrawRules: ValidationChain[] = [
    body('amount')
      .notEmpty().withMessage('Amount is required')
      .isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
    body('description')
      .optional()
      .isString().trim()
      .isLength({ max: 255 }).withMessage('Description cannot exceed 255 characters'),
  ];

  static transferRules: ValidationChain[] = [
    body('toAccountId')
      .notEmpty().withMessage('Destination account ID is required')
      .isUUID().withMessage('Destination account ID must be a valid UUID'),
    body('amount')
      .notEmpty().withMessage('Amount is required')
      .isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
    body('description')
      .optional()
      .isString().trim()
      .isLength({ max: 255 }).withMessage('Description cannot exceed 255 characters'),
  ];

  static statementRules: ValidationChain[] = [
    query('from')
      .notEmpty().withMessage('from date is required')
      .isISO8601().withMessage('from must be a valid ISO 8601 date'),
    query('to')
      .notEmpty().withMessage('to date is required')
      .isISO8601().withMessage('to must be a valid ISO 8601 date'),
  ];
}