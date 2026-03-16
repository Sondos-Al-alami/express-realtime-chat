import express, { type Request, type Response, type NextFunction } from 'express';

const router = express.Router();

/* GET users listing. */
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  res.send('respond with a resource');
});

export default router;

