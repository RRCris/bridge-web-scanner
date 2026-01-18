import { Router } from 'express';
import {
  listProfiles,
  getProfile,
  createProfile,
  updateProfile,
  deleteProfile,
} from '../controllers/profiles.controller';

const router = Router();

router.get('/', listProfiles);
router.get('/:name', getProfile);
router.post('/', createProfile);
router.put('/:name', updateProfile);
router.delete('/:name', deleteProfile);

export default router;