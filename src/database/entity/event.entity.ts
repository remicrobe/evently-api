export enum RecurrencePattern {
    Monthly = "monthly",
    Yearly = "yearly",
    Unique = "unique"
}

import {Category} from "./category.entity";
import {
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    Entity,
    JoinColumn,
    ManyToOne, OneToMany,
    PrimaryGeneratedColumn
} from "typeorm";
import {User} from "./user.entity";
import {JoinedEventEntity} from "./joined-event.entity";
import {Folder} from "./folder.entity";

@Entity()
export class Event {
    @PrimaryGeneratedColumn({})
    id: number;

    @Column({})
    name: string;

    @Column({ nullable: true })
    description: string;

    @Column({ nullable: true })
    location: string;

    @Column({ default: false })
    childCreated: boolean;

    @Column({
        type: "enum",
        enum: RecurrencePattern,
        nullable: true
    })
    recurrencePattern: RecurrencePattern;

    @Column({ nullable: true })
    interval: number;

    @Column({ nullable: true })
    maxOccurence: number;

    @Column({ nullable: true })
    targetDate: Date;

    @Column({ unique: true })
    inviteToken: string;

    @ManyToOne(() => Category)
    @JoinColumn({ name: 'categoryID' })
    category: Category;

    @Column({ nullable: true })
    categoryID: number;

    @ManyToOne(() => User, user => user.events)
    @JoinColumn({ name: 'userID' })
    user: User;

    @Column({ nullable: true })
    userID: number;

    @ManyToOne(() => Folder, f => f.events)
    @JoinColumn({ name: 'folderID' })
    folder: Folder;

    @Column({ nullable: true })
    folderID: number;

    @OneToMany(() => JoinedEventEntity, jev => jev.event, {
        cascade: true
    })
    joinedUser: JoinedEventEntity[];

    @CreateDateColumn({})
    createdAt: Date;

    @DeleteDateColumn({})
    deletedAt: Date;
}
