import {Column, CreateDateColumn, DeleteDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn} from "typeorm";
import {User} from "./user.entity";
import {RecurrencePattern} from "./event.entity";

export enum DeviceType {
    android = "android",
    apple = "apple",
    electron = "electron",
    web = "web",
}

@Entity()
export class Device {
    @PrimaryGeneratedColumn({})
    id: number;

    @ManyToOne(() => User)
    user: User;

    @Column({
        type: "enum",
        enum: DeviceType,
        nullable: false
    })
    device: DeviceType;

    @Column({})
    deviceId: string

    @CreateDateColumn({})
    registerDate: Date;

    @DeleteDateColumn({})
    deletedDate: Date;
}