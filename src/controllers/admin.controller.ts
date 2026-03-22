import { Request, Response } from 'express';
import { FraudAlertRepository, UserRepository, toPublicUser } from '../models';
import { FraudRiskLevel } from '../types';

export class AdminController {
  /**
   * GET /admin/audit-log
   * Paginated fraud alert log with optional filters:
   *   ?riskLevel=high&isResolved=false&userId=<uuid>&from=2026-01-01&to=2026-12-31&page=1&limit=20
   */
  getAuditLog = async (req: Request, res: Response): Promise<Response> => {
    try {
      const {
        riskLevel,
        isResolved,
        userId,
        from,
        to,
        page,
        limit,
      } = req.query;

      const validRiskLevels = Object.values(FraudRiskLevel) as string[];
      const options: Parameters<typeof FraudAlertRepository.findAll>[0] = {
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
      };

      if (riskLevel && validRiskLevels.includes(riskLevel as string)) {
        options.riskLevel = riskLevel as FraudRiskLevel;
      }
      if (isResolved !== undefined) {
        options.isResolved = isResolved === 'true';
      }
      if (userId) {
        options.userId = userId as string;
      }
      if (from) {
        options.from = new Date(from as string);
      }
      if (to) {
        options.to = new Date(to as string);
      }

      const { alerts, total } = await FraudAlertRepository.findAll(options);
      const currentPage = options.page!;
      const pageSize = options.limit!;

      return res.status(200).json({
        status: 'success',
        data: {
          alerts,
          pagination: {
            total,
            page: currentPage,
            limit: pageSize,
            pages: Math.ceil(total / pageSize),
          },
        },
      });
    } catch (error: any) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  };
}
