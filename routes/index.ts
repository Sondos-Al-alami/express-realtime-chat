import express, { type Request, type Response, type NextFunction } from 'express';

const router = express.Router();

/* GET home page. */
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  res.json({ message: 'Express Chat App API' });
});

export default router;

