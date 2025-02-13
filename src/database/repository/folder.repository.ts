import {AppDataSource} from "../datasource";
import {Folder} from "../entity/folder.entity";

export const FolderRepository = AppDataSource.getRepository(Folder).extend({});