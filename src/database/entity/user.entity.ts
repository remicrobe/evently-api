import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, DeleteDateColumn, OneToMany } from 'typeorm';
import {Category} from "./category.entity";
import {Event} from "./event.entity";
import {JoinedEventEntity} from "./joined-event.entity";

@Entity()
export class User {
    @PrimaryGeneratedColumn({})
    id: number;

    @Column({ nullable: true, unique: true })
    username: string;

    @Column({ nullable: true })
    firstName: string;

    @Column({ nullable: true })
    lastName: string;

    @Column({ nullable: true, unique: true })
    email: string;

    @Column({ nullable: true, unique: true })
    sub: string;

    @Column({ nullable: true })
    password: string;

    @Column({ nullable: true })
    provider: string;

    @Column({ default: false })
    isDeleted: boolean;

    @Column({ default: false })
    isCompleted: boolean;

    @CreateDateColumn({})
    createdAt: Date;

    @DeleteDateColumn({})
    deletedAt: Date;

    @OneToMany(() => Category, cat => cat.user, {
        cascade: true
    })
    categories: Category[];

    @OneToMany(() => Event, ev => ev.user, {
        cascade: true
    })
    events: Event[];

    @OneToMany(() => JoinedEventEntity, jev => jev.user, {
        cascade: true
    })
    joinedEvents: JoinedEventEntity[];
}
