import {Entity, PrimaryGeneratedColumn, Column, DeleteDateColumn, ManyToOne, JoinColumn} from "typeorm";
import { Event } from "./event.entity";
import { User } from "./user.entity";

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
}
