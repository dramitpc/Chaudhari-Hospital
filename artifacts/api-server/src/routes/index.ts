import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import patientsRouter from "./patients";
import appointmentsRouter from "./appointments";
import queueRouter from "./queue";
import consultationsRouter from "./consultations";
import prescriptionsRouter from "./prescriptions";
import drugsRouter from "./drugs";
import billingRouter from "./billing";
import certificatesRouter from "./certificates";
import auditRouter from "./audit";
import dashboardRouter from "./dashboard";
import reportsRouter from "./reports";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(patientsRouter);
router.use(appointmentsRouter);
router.use(queueRouter);
router.use(consultationsRouter);
router.use(prescriptionsRouter);
router.use(drugsRouter);
router.use(billingRouter);
router.use(certificatesRouter);
router.use(auditRouter);
router.use(dashboardRouter);
router.use(reportsRouter);
router.use(settingsRouter);

export default router;
