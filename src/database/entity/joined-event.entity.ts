import { Entity, PrimaryGeneratedColumn, Column, DeleteDateColumn, ManyToOne } from "typeorm";
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
    event: Event;

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
