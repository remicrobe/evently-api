import {CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn} from "typeorm";
import {User} from "./user.entity";

@Entity()
export class FriendsRequest {
    @PrimaryGeneratedColumn({})
    id: number;

    @ManyToOne(() => User)
    asker: User;

    @ManyToOne(() => User)
    receiver: User;

    @CreateDateColumn({type: "timestamp", select: false})
    createdAt: Date;
}