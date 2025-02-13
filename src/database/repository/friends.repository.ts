import {AppDataSource} from "../datasource";
import {Friends} from "../entity/friends.entity";

export const FriendsRepository = AppDataSource.getRepository(Friends).extend({
    async findFriends(userId: number) : Promise <Friends[]> {
        return await this.createQueryBuilder("friend")
            .leftJoinAndSelect("friend.user1", "u1")
            .leftJoinAndSelect("friend.user2", "u2")
            .andWhere("(u1.id = :userId OR u2.id = :userId)", { userId: userId })
            .getMany();
    },
    async areTheyFriends(userId1: number, userId2: number) {
        let friend = await this.createQueryBuilder("friend")
            .leftJoinAndSelect("friend.user1", "u1")
            .leftJoinAndSelect("friend.user2", "u2")
            .andWhere("((u1.id = :userId1 and u2.id = :userId2) or (u1.id = :userId22 and u2.id = :userId11))", { userId1: userId1, userId2: userId2, userId11: userId1, userId22: userId2 })
            .getOne()

        if (friend) {
            return true;
        }
    },
    async getFriends(userId1: number, userId2: number) {
        return await this.createQueryBuilder("friend")
            .leftJoinAndSelect("friend.user1", "u1")
            .leftJoinAndSelect("friend.user2", "u2")
            .andWhere("((u1.id = :userId1 and u2.id = :userId2) or (u1.id = :userId22 and u2.id = :userId11))", { userId1: userId1, userId2: userId2, userId11: userId1, userId22: userId2 })
            .getOne()
    }
})
