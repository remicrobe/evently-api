import {EventRepository} from "../repository/event.repository";

export enum RecurrencePattern {
    Monthly = "monthly",
    Yearly = "yearly",
    Unique = "unique"
}

import {Category} from "./category.entity";
import {
    AfterInsert, AfterUpdate, BeforeRemove,
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    Entity,
    JoinColumn,
    ManyToOne, OneToMany,
    PrimaryGeneratedColumn
} from "typeorm";
import {User} from "./user.entity";
import {InvitationStatus, JoinedEventEntity} from "./joined-event.entity";
import {Folder} from "./folder.entity";
import {pleaseReload} from "../../socket/pleaseReload";
import {ApnUtils} from "../../utils/apn.utils";
import {DeviceType} from "./device.entity";

@Entity()
export class Event {
    @PrimaryGeneratedColumn({})
    id: number;

    @Column({})
    name: string;

    @Column({ nullable: true, length: 1000 })
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

    @Column({ unique: true, nullable: true, default: null })
    inviteToken: string;

    @ManyToOne(() => Category)
    @JoinColumn({ name: 'categoryID' })
    category: Category;

    @Column({ nullable: false })
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
        cascade: ['remove', 'soft-remove']
    })
    joinedUser: JoinedEventEntity[];

    @CreateDateColumn({})
    createdAt: Date;

    @DeleteDateColumn({})
    deletedAt: Date;

    @AfterInsert()
    async advertUser() {
        await this.reloadEventWithRelations({
            user: { devices: true },
            joinedUser: { user: true },
            category: true,
            folder: {
                joinedUser: {
                    user: {
                        devices: true
                    }
                },
                user: {
                    devices: true
                }
            }
        });
    }

    @AfterUpdate()
    async advertUpdate() {
        await this.reloadEventWithRelations({
            user: true,
            joinedUser: { user: true },
            category: true,
            folder: {
                joinedUser: {
                    user: {
                        devices: true
                    }
                },
                user: {
                    devices: true
                }
            }
        });
    }

    @BeforeRemove()
    async advertRemove() {
        await this.reloadEventWithRelations({
            user: { devices: true },
            joinedUser: { user: { devices: true } },
            category: true,
            folder: {
                joinedUser: {
                    user: {
                        devices: true
                    }
                },
                user: {
                    devices: true
                }
            }
        }, 'delete');
    }

    private async reloadEventWithRelations(relations: any, action?: string) {
        const fullEvent = await EventRepository.findOne({
            where: { id: this.id },
            relations
        });

        const pendingUser = fullEvent.joinedUser.filter(join => join.invitationStatus === InvitationStatus.INVITED);
        const acceptedUser = fullEvent.joinedUser.filter(join => join.invitationStatus === InvitationStatus.ACCEPTED);

        pleaseReload(acceptedUser.map(j => j.user.id), 'event', fullEvent.id, action);
        pleaseReload(pendingUser.map(j => j.user.id), 'event-invite', fullEvent.id, action);

        if (!action || action !== 'delete') {
            acceptedUser.forEach(join => {
                join.user.devices?.filter(device => device.device === DeviceType.apple)
                    .forEach(device => {
                        ApnUtils.sendAPNNotification("event", fullEvent.id, device.deviceId);
                    });
            });
            pendingUser.forEach(join => {
                join.user.devices?.filter(device => device.device === DeviceType.apple)
                    .forEach(device => {
                        ApnUtils.sendAPNNotification("event-invite", fullEvent.id, device.deviceId);
                    });
            });
        }

        if (fullEvent.folder && fullEvent.folder.user && fullEvent.user.id === fullEvent.folder.user.id && (!action || action !== 'delete')) {
            fullEvent.folder.joinedUser.forEach(join => {
                // Si le créateur est l'owner du folder, on exclut le créateur ; sinon, il est inclus
                if (fullEvent.user.id === fullEvent.folder.user.id && join.user.id === fullEvent.user.id) {
                    return;
                }

                join.user.devices?.filter(device => device.device === DeviceType.apple)
                    .forEach(device => {
                        ApnUtils.sendAPNNotification("event", fullEvent.id, device.deviceId);
                    });
            });

            // Si le créateur de l'événement n'est pas l'owner du folder, on l'ajoute aux notifications
            if (fullEvent.user.id !== fullEvent.folder.user.id) {
                fullEvent.user.devices?.filter(device => device.device === DeviceType.apple)
                    .forEach(device => {
                        ApnUtils.sendAPNNotification("event", fullEvent.id, device.deviceId);
                    });
            }
        }
    }
}

