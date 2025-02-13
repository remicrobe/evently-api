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
import {JoinedFolderEntity} from "./joined-folder.entity";
import {Event} from "./event.entity";

@Entity()
export class Folder {
    @PrimaryGeneratedColumn({})
    id: number;

    @Column({})
    name: string;

    @Column({ unique: true })
    inviteToken: string;

    @ManyToOne(() => User, user => user.events)
    @JoinColumn({ name: 'userID' })
    user: User;

    @Column({ nullable: true })
    userID: number;

    @OneToMany(() => JoinedFolderEntity, jf => jf.folder, {
        cascade: true
    })
    joinedUser: JoinedFolderEntity[];

    @OneToMany(() => Event, ev => ev.folder, {
        cascade: true
    })
    events: Event[];

    @CreateDateColumn({})
    createdAt: Date;

    @DeleteDateColumn({})
    deletedAt: Date;
}