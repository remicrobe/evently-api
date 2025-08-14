import express = require("express");
import { ErrorHandler } from "../utils/error/error-handler";
import { CategoryRepository } from "../database/repository/category.repository";
import { apiTokenMiddleware } from "../middlewares/checkApiToken";
import { User } from "../database/entity/user.entity";
import { Equal } from "typeorm";
import { Category } from "../database/entity/category.entity";
import { Code } from "../utils/Code";
import { ResponseMessage } from "../utils/ResponseMessage";

const categoryRouter = express.Router ();

const error = (message: string) => ({ error: message });

categoryRouter.post ('/', apiTokenMiddleware, async (req, res) => {
    /**
     #swagger.tags = ['Category']
     #swagger.path = '/categories'
     #swagger.description = 'Create a new category'
     #swagger.parameters['body'] = {
     in: 'body',
     description: 'Category details',
     required: true,
     schema: {
     name: "Example",
     icon: "icon",
     color: "#FFFFFF"
     }
     }
     #swagger.responses[200] = {
     schema: { $ref: '#/definitions/Category' }
     }
     */
    const { name, icon, color } = req.body;
    if (!name || !icon || !color) {
        return res.status (Code.UNPROCESSABLE_ENTITY).send (error (ResponseMessage.MISSING_REQUIRED_FIELDS));
    }

    const user: User = res.locals.connectedUser;
    const newCategory = new Category ();
    newCategory.name = name;
    newCategory.icon = icon;
    newCategory.color = color;
    newCategory.default = false;
    newCategory.user = user;

    const savedCategory = await CategoryRepository.save (newCategory);
    res.status (Code.OK).send (savedCategory);
});

categoryRouter.get ('/', apiTokenMiddleware, async (req, res) => {
    /**
     #swagger.tags = ['Category']
     #swagger.path = '/categories'
     #swagger.description = 'Get user categories'
     #swagger.responses[200] = {
     schema: { $ref: '#/definitions/Category' }
     }
     */
    const user: User = res.locals.connectedUser;
    const categories = await CategoryRepository.find ({
        where: { user: { id: Equal (user.id) } }
    });
    res.status (Code.OK).send (categories);
});

categoryRouter.get ('/default', apiTokenMiddleware, async (req, res) => {
    /**
     #swagger.tags = ['Category']
     #swagger.path = '/categories/default'
     #swagger.description = 'Get default categories'
     #swagger.responses[200] = {
     schema: { $ref: '#/definitions/Category' }
     }
     */
    const defaultCategories = await CategoryRepository.find ({
        where: { default: true }
    });
    res.status (Code.OK).send (defaultCategories);
});

categoryRouter.put ('/:id', apiTokenMiddleware, async (req, res) => {
    /**
     #swagger.tags = ['Category']
     #swagger.path = '/categories/{id}'
     #swagger.description = 'Update category'
     #swagger.parameters['body'] = {
     in: 'body',
     schema: {
     name: "Updated name",
     icon: "updated-icon",
     color: "#000000"
     }
     }
     */
    const { id } = req.params;
    const user: User = res.locals.connectedUser;

    const category = await CategoryRepository.findOne ({
        where: { id: Number (id), user: { id: Equal (user.id) } }
    });
    if (!category) {
        return res.status (Code.NOT_FOUND).send (error (ResponseMessage.CATEGORY_NOT_FOUND));
    }

    if (req.body.name !== undefined) category.name = req.body.name;
    if (req.body.icon !== undefined) category.icon = req.body.icon;
    if (req.body.color !== undefined) category.color = req.body.color;
    if (req.body.default !== undefined) category.default = req.body.default;

    const updatedCategory = await CategoryRepository.save (category);
    res.status (Code.OK).send (updatedCategory);
});

categoryRouter.delete ('/:id', apiTokenMiddleware, async (req, res) => {
    /**
     #swagger.tags = ['Category']
     #swagger.path = '/categories/{id}'
     #swagger.description = 'Delete category'
     */
    const { id } = req.params;
    const user: User = res.locals.connectedUser;

    const category = await CategoryRepository.findOne ({
        where: { id: Number (id), user: { id: Equal (user.id) } }
    });
    if (!category) {
        return res.status (Code.NOT_FOUND).send (error (ResponseMessage.CATEGORY_NOT_FOUND));
    }

    await CategoryRepository.remove (category);
    res.status (Code.NO_CONTENT).send ();
});

export { categoryRouter };
