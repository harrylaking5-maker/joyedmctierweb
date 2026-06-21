import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ariaRouter from "./aria";
import systemRouter from "./system";

const router: IRouter = Router();

router.use(healthRouter);
router.use(ariaRouter);
router.use(systemRouter);

export default router;
