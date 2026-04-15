import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as userController from '../controllers/userController';

const router = Router();

router.get('/:email/hierarchy', authenticate, userController.getUserHierarchy);
router.post('/hierarchy/search', authenticate, userController.bulkGetUserHierarchy);

export default router;
