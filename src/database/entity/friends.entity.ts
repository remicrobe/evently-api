import {CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn} from "typeorm";
import {User} from "./user.entity";

@Entity()
export class Friends {
    @PrimaryGeneratedColumn({})
    id: number;

    @ManyToOne(() => User)
    user1: User;

    @ManyToOne(() => User)
    user2: User;

    @CreateDateColumn({type: "timestamp", select: false})
    createdAt: Date;
}