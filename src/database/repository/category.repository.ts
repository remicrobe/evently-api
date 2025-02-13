import {Category} from "../entity/category.entity";
import {AppDataSource} from "../datasource";

export const CategoryRepository = AppDataSource.getRepository(Category).extend({});