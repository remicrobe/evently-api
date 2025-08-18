import {AppDataSource} from "../datasource";
import {Event} from "../entity/event.entity";
import {InvitationStatus} from "../entity/joined-event.entity";
import {pleaseReload} from "../../socket/pleaseReload";
import {DeviceType} from "../entity/device.entity";
import {ApnUtils} from "../../utils/apn.utils";
import { Brackets } from "typeorm";

export const EventRepository = AppDataSource.getRepository(Event).extend({
    async advertUser(eventId: number, action?: 'delete' | 'update') {
        const fullEvent = await EventRepository.findOne({
            where: { id: eventId},
            relations: {
                user: { devices: true },
                joinedUser: { user: { devices: true } },
                category: true,
                folder: {
                    joinedUser: {
                        user: {
                            devices: true
                        }
                    },
                    user: {
                        devices: true
                    }
                }
            }
        });

        const typePush = `event${action ? `-${action}` : ''}`;

        const pendingUser = fullEvent.joinedUser.filter(join => join.invitationStatus === InvitationStatus.INVITED);
        const acceptedUser = fullEvent.joinedUser.filter(join => join.invitationStatus === InvitationStatus.ACCEPTED);

        pleaseReload(acceptedUser.map(j => j.user.id), 'event', fullEvent.id, action);
        pleaseReload(pendingUser.map(j => j.user.id), 'event-invite', fullEvent.id, action);

        if (!action || action !== 'delete') {
            acceptedUser.forEach(join => {
                join.user.devices?.filter(device => device.device === DeviceType.apple)
                    .forEach(device => {
                        ApnUtils.sendAPNNotification(typePush, fullEvent.id, device.deviceId, fullEvent.name);
                    });
            });
            pendingUser.forEach(join => {
                join.user.devices?.filter(device => device.device === DeviceType.apple)
                    .forEach(device => {
                        ApnUtils.sendAPNNotification("event-invite", fullEvent.id, device.deviceId);
                    });
            });
        }

        if (fullEvent.folder && fullEvent.folder.user && fullEvent.user.id === fullEvent.folder.user.id && (!action || action !== 'delete')) {
            fullEvent.folder.joinedUser.forEach(join => {
                // Si le créateur est l'owner du folder, on exclut le créateur ; sinon, il est inclus
                if (fullEvent.user.id === fullEvent.folder.user.id && join.user.id === fullEvent.user.id) {
                    return;
                }

                join.user.devices?.filter(device => device.device === DeviceType.apple)
                    .forEach(device => {
                        ApnUtils.sendAPNNotification(typePush, fullEvent.id, device.deviceId, fullEvent.name, fullEvent.folder.name);
                    });
            });

            // Si le créateur de l'événement n'est pas l'owner du folder, on l'ajoute aux notifications
            if (fullEvent.user.id !== fullEvent.folder.user.id) {
                fullEvent.user.devices?.filter(device => device.device === DeviceType.apple)
                    .forEach(device => {
                        ApnUtils.sendAPNNotification(typePush, fullEvent.id, device.deviceId, fullEvent.name, fullEvent.folder.name);
                    });
            }
        }
    },

    userEventsBaseQuery(userId: number) {
        const query = EventRepository.createQueryBuilder ("event")
                .leftJoinAndSelect ("event.joinedUser", "joinedUser")
                .leftJoinAndSelect ("event.user", "creator")
                .leftJoinAndSelect ("joinedUser.user", "joinedUserUser")
                .leftJoinAndSelect ("event.category", "category")
                .leftJoinAndSelect ("event.folder", "folder")
                .leftJoinAndSelect ("folder.joinedUser", "folderJoinedUser")
                .orderBy ('event.targetDate', 'ASC')
        
            query.where (new Brackets (qb => {
                qb.where ("event.userID = :userId", { userId: userId })
                    .orWhere ("joinedUserUser.id = :userId AND joinedUser.invitationStatus = :accepted", {
                        userId: userId,
                        accepted: InvitationStatus.ACCEPTED
                    })
                    .orWhere ("folder.userID = :userId", { userId: userId })
                    .orWhere ("folderJoinedUser.userID = :userId", { userId: userId })
            }))
         
            return query;
    }
});