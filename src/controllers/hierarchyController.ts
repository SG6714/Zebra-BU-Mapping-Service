import { Request, Response, NextFunction } from 'express';
import * as hierarchyService from '../services/hierarchyService';
import { NodeType } from '../models/HierarchyNode';

const VALID_TYPES: NodeType[] = ['strategic_pillar', 'business_unit', 'team', 'group'];

export async function addNode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { type, name, leader_email, parent_id } = req.body;

    if (!type || !name || !leader_email) {
      res.status(400).json({ error: 'Fields type, name, and leader_email are required' });
      return;
    }

    if (!VALID_TYPES.includes(type)) {
      res.status(400).json({
        error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}`,
      });
      return;
    }

    if (parent_id) {
      const parent = await hierarchyService.getNodeById(parent_id);
      if (!parent) {
        res.status(404).json({ error: `Parent node with id ${parent_id} not found` });
        return;
      }
    }

    const node = await hierarchyService.addNode({ type, name, leader_email, parent_id });
    res.status(201).json(node);
  } catch (error) {
    next(error);
  }
}

export async function updateLeader(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { nodeId } = req.params;
    const { leader_email } = req.body;

    if (!nodeId) {
      res.status(400).json({ error: 'Node ID is required' });
      return;
    }

    if (!leader_email) {
      res.status(400).json({ error: 'leader_email is required' });
      return;
    }

    const updated = await hierarchyService.updateLeader(nodeId, leader_email);

    if (!updated) {
      res.status(404).json({ error: `Node with id ${nodeId} not found` });
      return;
    }

    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
}

export async function getNodesByType(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { type } = req.params;

    if (!VALID_TYPES.includes(type as NodeType)) {
      res.status(400).json({
        error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}`,
      });
      return;
    }

    const nodes = await hierarchyService.getNodesByType(type as NodeType);
    res.status(200).json(nodes);
  } catch (error) {
    next(error);
  }
}
