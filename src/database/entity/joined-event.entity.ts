import {Column, DeleteDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn} from "typeorm";
import {Event} from "./event.entity";
import {User} from "./user.entity";

@Entity()
export class JoinedEventEntity {
    @PrimaryGeneratedColumn({})
    id: number;

    @ManyToOne(() => Event, event => event.joinedUser)
    event: Event;

    @ManyToOne(() => User, user => user.joinedEvents)
    user: User;

    @Column({})
    joinDate: Date;

    @DeleteDateColumn({ nullable: true })
    leaveDate: Date;
}