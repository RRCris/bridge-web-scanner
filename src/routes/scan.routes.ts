import { Router } from 'express';
import { startScan } from '../controllers/scan.controller';

const router = Router();

router.post('/', startScan);

export default router;
