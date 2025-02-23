import {AppDataSource} from "../datasource";
import {InvitationStatus, JoinedEventEntity} from "../entity/joined-event.entity";
import {EventRepository} from "./event.repository";
import {pleaseReload} from "../../socket/pleaseReload";

export const JoinedEventRepository = AppDataSource.getRepository(JoinedEventEntity).extend({
    async advertUser(eventId: number, entity: JoinedEventEntity) {
        const fullEvent = await EventRepository.findOne({
            where: {
                id: eventId
            },
            relations: {
                user: {
                    devices: true
                },
                joinedUser: {
                    user: true
                },
                category: true,
                folder: true
            }
        })

        const pendingUser = fullEvent.joinedUser.filter(join => join.invitationStatus === InvitationStatus.INVITED).map(j => j.user.id);
        const acceptedUser = fullEvent.joinedUser.filter(join => join.invitationStatus === InvitationStatus.ACCEPTED).map(j => j.user.id);

        if (entity.invitationStatus !== InvitationStatus.INVITED) {
            pendingUser.push(fullEvent.userID)
        }

        pleaseReload(pendingUser, 'event', fullEvent.id);
        pleaseReload(acceptedUser, 'event-invite', fullEvent.id);
    }
});