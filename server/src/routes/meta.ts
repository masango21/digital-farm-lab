import { Router } from 'express';
import { z } from 'zod';
import { CROP_LIST, SOILS, COSTS, IRRIGATION_OPTIONS_MM, WILTING_POINT_PCT, WATERLOGGING_PCT } from '../simulation/crops';
import { SCORE_WEIGHTS } from '../simulation/engine';
import { requireAuth, requireRole } from '../middleware/auth';
import { createUploadSignature } from '../lib/cloudinary';

export const metaRouter = Router();

// GET /api/crops – reference data for the app (public)
metaRouter.get('/crops', (_req, res) => {
  res.json({
    crops: CROP_LIST,
    soils: Object.values(SOILS),
    costs: COSTS,
    irrigationOptionsMm: IRRIGATION_OPTIONS_MM,
    wiltingPointPct: WILTING_POINT_PCT,
    waterloggingPct: WATERLOGGING_PCT,
    scoreWeights: SCORE_WEIGHTS,
  });
});

// POST /api/uploads/signature – trainer gets a short-lived signed Cloudinary upload
metaRouter.post('/uploads/signature', requireAuth, requireRole('trainer'), (req, res) => {
  z.object({}).passthrough().parse(req.body ?? {});
  res.json(createUploadSignature(req.user!.id));
});
