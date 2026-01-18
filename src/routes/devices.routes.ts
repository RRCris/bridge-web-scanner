import { Router } from 'express';
import { listDevices } from '../controllers/devices.controller';

const router = Router();

router.get('/', listDevices);

export default router;
