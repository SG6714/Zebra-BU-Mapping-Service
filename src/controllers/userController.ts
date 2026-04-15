import { Request, Response, NextFunction } from 'express';
import * as hierarchyService from '../services/hierarchyService';

export async function getUserHierarchy(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email } = req.params;

    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'Valid email parameter is required' });
      return;
    }

    const hierarchy = await hierarchyService.getUserHierarchy(email);

    if (!hierarchy) {
      res.status(404).json({ error: `No hierarchy found for email: ${email}` });
      return;
    }

    res.status(200).json(hierarchy);
  } catch (error) {
    next(error);
  }
}

export async function bulkGetUserHierarchy(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { emails } = req.body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      res.status(400).json({ error: 'Request body must contain a non-empty emails array' });
      return;
    }

    if (emails.length > 100) {
      res.status(400).json({ error: 'Maximum of 100 emails allowed per request' });
      return;
    }

    const results = await hierarchyService.bulkGetUserHierarchy(emails);
    res.status(200).json(results);
  } catch (error) {
    next(error);
  }
}
