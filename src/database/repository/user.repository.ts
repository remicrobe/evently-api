import {AppDataSource} from "../datasource";
import { User } from "../entity/user.entity";
import { DateTime } from "luxon";
import { MoreThanOrEqual } from "typeorm";

export const UserRepository = AppDataSource.getRepository(User).extend({
    createUser(email: string, password: string, provider: string, isCompleted: boolean) {
        let user = new User();
        user.email = email
        user.password = password
        user.provider = provider
        user.isCompleted = isCompleted
        return user;
    },
    async getTotalUsers(args: 'total' | 'daily' | 'monthly' | 'yearly' | 'weekly') {
        let dateQuery;
        const now = new Date();

        switch (args) {
            case "daily":
                dateQuery = { createdAt: MoreThanOrEqual(DateTime.now().minus({ day: 1}).toJSDate()) };
                break;
            case "weekly":
                dateQuery = { createdAt: MoreThanOrEqual(DateTime.now().minus({ day: 7 }).toJSDate()) };
                break;
            case "monthly":
                dateQuery = { createdAt: MoreThanOrEqual(DateTime.now().minus({ month: 1 }).toJSDate()) };
                break;
            case "yearly":
                dateQuery = { createdAt: MoreThanOrEqual(DateTime.now().minus({ year: 1 }).toJSDate()) };
                break;
            case "total":
            default:
                dateQuery = {};
                break;
        }

        return UserRepository.countBy(dateQuery);
    },
})