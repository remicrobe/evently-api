import {Column, DeleteDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn} from "typeorm";
import {User} from "./user.entity";
import {Folder} from "./folder.entity";
import { Event } from "./event.entity";

@Entity({ synchronize: false })
export class JoinedFolderEntity {
    @PrimaryGeneratedColumn({})
    id: number;

    @ManyToOne(() => Folder, f => f.joinedUser)
    @JoinColumn({ name: 'folderId' })
    folder: Folder;

    @Column({ nullable: true })
    folderId: number;

    @ManyToOne(() => User, user => user.joinedEvents)
    @JoinColumn({ name: 'userID' })
    user: User;

    @Column({ nullable: true })
    userID: number;

    @Column({})
    joinDate: Date;

    @DeleteDateColumn({ nullable: true })
    leaveDate: Date;
}