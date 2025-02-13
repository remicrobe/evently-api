import {AppDataSource} from "../datasource";
import {JoinedEventEntity} from "../entity/joined-event.entity";

export const JoinedEventRepository = AppDataSource.getRepository(JoinedEventEntity).extend({});