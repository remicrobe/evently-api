import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    DeleteDateColumn,
    ManyToOne,
    JoinColumn,
    AfterInsert,
    AfterUpdate
} from "typeorm";
import { Event } from "./event.entity";
import { User } from "./user.entity";
import {EventRepository} from "../repository/event.repository";
import {pleaseReload} from "../../socket/pleaseReload";

export enum InvitationStatus {
    INVITED = "invited",
    PENDING = "pending",
    ACCEPTED = "accepted"
}

@Entity()
export class JoinedEventEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Event, event => event.joinedUser)
    @JoinColumn({ name: 'eventId' })
    event: Event;

    @Column({ nullable: true })
    eventId: number;

    @ManyToOne(() => User, user => user.joinedEvents)
    user: User;

    @Column()
    joinDate: Date;

    @DeleteDateColumn({ nullable: true })
    leaveDate: Date;

    @Column({
        type: "enum",
        enum: InvitationStatus,
        default: InvitationStatus.INVITED
    })
    invitationStatus: InvitationStatus;

    @AfterInsert()
    async advertUser() {
        const fullEvent = await EventRepository.findOne({
            where: {
                id: this.eventId
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

        if (this.invitationStatus !== InvitationStatus.INVITED) {
            pendingUser.push(fullEvent.userID)
        }

        pleaseReload(pendingUser, 'event', fullEvent.id);
        pleaseReload(acceptedUser, 'event-invite', fullEvent.id);
    }

    @AfterUpdate()
    async adverUserOfUpdate() {
        const fullEvent = await EventRepository.findOne({
            where: {
                id: this.eventId
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

        if (this.invitationStatus !== InvitationStatus.INVITED) {
            pendingUser.push(fullEvent.userID)
        }

        pleaseReload(pendingUser, 'event', fullEvent.id);
        pleaseReload(acceptedUser, 'event-invite', fullEvent.id);
    }
}
