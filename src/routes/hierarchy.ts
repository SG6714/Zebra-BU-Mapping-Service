import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { auditLog } from '../middleware/audit';
import * as hierarchyController from '../controllers/hierarchyController';

const router = Router();

router.get('/:type', authenticate, hierarchyController.getNodesByType);
router.post('/', authenticate, auditLog('CREATE', 'HierarchyNode'), hierarchyController.addNode);
router.put(
  '/:nodeId/leader',
  authenticate,
  auditLog('UPDATE', 'HierarchyNode'),
  hierarchyController.updateLeader
);

export default router;
