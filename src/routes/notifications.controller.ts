import express = require("express");
import { Equal, getRepository } from "typeorm";
import { Device, DeviceType } from "../database/entity/device.entity";
import { checkRequiredField } from "../utils/global";
import { ErrorHandler } from "../utils/error/error-handler";
import { apiTokenMiddleware } from "../middlewares/checkApiToken";
import { DeviceRepository } from "../database/repository/device.repository";

const notificationsRouter = express.Router ();

notificationsRouter.post ('/subscribe/ios', apiTokenMiddleware, async (req, res) => {
    /** #swagger.tags = ['Notifications']
     #swagger.path = '/notifications/subscribe/ios'
     #swagger.description = 'Souscrire un device iOS. Si l\'utilisateur possède déjà un device de type apple, il sera supprimé et remplacé par le nouveau.'
     #swagger.parameters['body'] = {
     in: 'body',
     description: 'Contient le device token iOS.',
     required: true,
     schema: { deviceToken: 'string' }
     }
     #swagger.responses[200] = {
     description: 'Device iOS souscrit avec succès.',
     schema: { msg: 'Device subscribed successfully' }
     }
     */
    const { deviceToken } = req.body;
    if (!checkRequiredField ([ deviceToken ])) {
        return res.sendStatus (422);
    }

    const user = res.locals.connectedUser;

    const existingDevice = await DeviceRepository.findOne ({
        where: {
            user: {
                id: Equal (user.id)
            },
            device: DeviceType.apple
        }
    });

    if (existingDevice) {
        existingDevice.deletedDate = new Date ();
        await DeviceRepository.save (existingDevice);
    }

    const newDevice = DeviceRepository.create ({
        user,
        device: DeviceType.apple,
        deviceId: deviceToken
    });

    await DeviceRepository.save (newDevice);

    return res.send ({ msg: 'Device subscribed successfully' });
});

export { notificationsRouter };
