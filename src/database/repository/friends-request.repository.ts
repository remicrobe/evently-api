import {AppDataSource} from "../datasource";
import {FriendsRequest} from "../entity/friends-request.entity";

export const FriendsRequestRepository = AppDataSource.getRepository(FriendsRequest).extend({
    async alreadyRequested(userId1: number, userId2: number) {
        let friend = await this.createQueryBuilder("friend")
            .leftJoinAndSelect("friend.asker", "u1")
            .leftJoinAndSelect("friend.receiver", "u2")
            .andWhere("((u1.id = :userId1 and u2.id = :userId2) or (u1.id = :userId22 and u2.id = :userId11))", { userId1: userId1, userId2: userId2, userId11: userId1, userId22: userId2 })
            .getOne()

        if (friend) {
            return true;
        }
    },
    async getPendingRequests(userId: number) {
        return await this.createQueryBuilder("friend")
            .leftJoinAndSelect("friend.asker", "u1")
            .leftJoinAndSelect("friend.receiver", "u2")
            .where("u1.id = :userId", {userId: userId})
            .getMany();
    }

})
