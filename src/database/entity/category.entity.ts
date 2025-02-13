import {User} from "./user.entity";
import {Column, Entity, ManyToOne, PrimaryGeneratedColumn} from "typeorm";

@Entity()
export class Category {
    @PrimaryGeneratedColumn({})
    id: number;

    @Column({})
    name: string;

    @Column({})
    icon: string;

    @Column({})
    color: string;

    @Column({})
    default: boolean;

    @ManyToOne(() => User, user => user.categories)
    user: User;
}