import { Router } from 'express';
import devicesRoutes from './devices.routes';
import profilesRoutes from './profiles.routes';
import scanRoutes from './scan.routes';
import filesRoutes from './files.routes';

const router = Router();

router.use('/devices', devicesRoutes);
router.use('/profiles', profilesRoutes);
router.use('/scan', scanRoutes);
router.use('/files', filesRoutes);

export default router;
