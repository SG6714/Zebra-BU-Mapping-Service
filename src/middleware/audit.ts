import { Request, Response, NextFunction } from 'express';
import { AuditLog } from '../models/AuditLog';
import logger from '../utils/logger';

export function auditLog(action: string, entityType: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const originalJson = res.json.bind(res);

    res.json = function (data: unknown) {
      const entityId =
        req.params.nodeId ||
        req.params.email ||
        (data && typeof data === 'object' && 'id' in data ? String((data as Record<string, unknown>).id) : 'unknown');

      AuditLog.create({
        action,
        entity_type: entityType,
        entity_id: entityId,
        changed_by: (req.headers['x-api-key'] as string) || 'unknown',
        changes: req.body || {},
        timestamp: new Date(),
      }).catch((err: Error) => logger.error('Audit log error:', err));

      return originalJson(data);
    };

    next();
  };
}
