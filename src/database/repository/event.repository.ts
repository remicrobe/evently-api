import {AppDataSource} from "../datasource";
import {Event} from "../entity/event.entity";

export const EventRepository = AppDataSource.getRepository(Event).extend({});