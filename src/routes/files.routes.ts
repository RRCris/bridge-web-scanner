import { Router } from 'express';
import { listFiles, downloadFile, deleteFile, clearFiles } from '../controllers/files.controller';

const router = Router();

router.get('/', listFiles);
router.delete('/clear', clearFiles);
router.get('/:id', downloadFile);
router.delete('/:id', deleteFile);

export default router;
