import {AppDataSource} from "../datasource";
import {JoinedFolderEntity} from "../entity/joined-folder.entity";

export const JoinedFolderRepository = AppDataSource.getRepository(JoinedFolderEntity).extend({});