import prisma from "@hey/db/prisma/db/client";
import { delRedis } from "@hey/db/redisClient";
import logger from "@hey/helpers/logger";
import parseJwt from "@hey/helpers/parseJwt";
import type { Request, Response } from "express";
import catchedError from "src/helpers/catchedError";
import { rateLimiter } from "src/helpers/middlewares/rateLimiter";
import validateLensAccount from "src/helpers/middlewares/validateLensAccount";
import { invalidBody, noBody } from "src/helpers/responses";
import { object, string } from "zod";

interface ExtensionRequest {
  message: string;
  emoji: string;
}

const validationSchema = object({
  message: string().max(80),
  emoji: string()
});

export const post = [
  rateLimiter({ requests: 50, within: 1 }),
  validateLensAccount,
  async (req: Request, res: Response) => {
    const { body } = req;

    if (!body) {
      return noBody(res);
    }

    const validation = validationSchema.safeParse(body);

    if (!validation.success) {
      return invalidBody(res);
    }

    const { message, emoji } = body as ExtensionRequest;

    try {
      const idToken = req.headers["x-id-token"] as string;
      const payload = parseJwt(idToken);

      const accountStatus = await prisma.profileStatus.upsert({
        create: { message, emoji, id: payload.id },
        update: { message, emoji },
        where: { id: payload.id }
      });

      await delRedis(`account:${payload.id}`);
      logger.info(`Updated account status for ${payload.id}`);

      return res.status(200).json({ result: accountStatus, success: true });
    } catch (error) {
      return catchedError(res, error);
    }
  }
];
