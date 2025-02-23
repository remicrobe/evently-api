import {AppDataSource} from "../datasource";
import {Device} from "../entity/device.entity";

export const DeviceRepository = AppDataSource.getRepository(Device).extend({
})