import express = require("express");
import { randomUUID } from "crypto";
import { ErrorHandler } from "../utils/error/error-handler";
import { apiTokenMiddleware } from "../middlewares/checkApiToken";
import { FolderRepository } from "../database/repository/folder.repository";
import { JoinedFolderRepository } from "../database/repository/joined-folder.repository";
import { Folder } from "../database/entity/folder.entity";
import { JoinedFolderEntity } from "../database/entity/joined-folder.entity";
import { User } from "../database/entity/user.entity";
import { getRepository } from "typeorm";
import { Code } from "../utils/Code";
import { ResponseMessage } from "../utils/ResponseMessage";
import {UserRepository} from "../database/repository/user.repository";
import {generateRandomString} from "../utils/global";

const folderRouter = express.Router();

const error = (message: string) => ({ error: message });

/**
 * Créer un folder avec possibilité d'ajouter des amis par leur username.
 */
folderRouter.post('/', apiTokenMiddleware, async (req, res) => {
    /*
        #swagger.tags = ['Folder']
        #swagger.path = '/folders'
        #swagger.method = 'post'
        #swagger.description = 'Create a new folder. Optionnellement, ajoutez des amis via leur username (tableau "friends").'
        #swagger.parameters['body'] = {
            in: 'body',
            description: 'Folder creation data',
            required: true,
            schema: {
                name: "Folder name",
                friends: ["username1", "username2"]
            }
        }
        #swagger.responses[201] = {
            description: 'Folder created successfully.',
            schema: { $ref: '#/definitions/Folder' }
        }
        #swagger.responses[422] = {
            description: 'Missing required fields.',
            schema: {
                status: 422,
                msg: 'Missing required fields'
            }
        }
    */
    try {
        const { name, friends } = req.body;
        if (!name) {
            return res.status(Code.UNPROCESSABLE_ENTITY).send(error(ResponseMessage.MISSING_REQUIRED_FIELDS));
        }
        const user: User = res.locals.connectedUser;
        const newFolder = new Folder();
        newFolder.name = name;
        newFolder.user = user;
        newFolder.userID = user.id;
        newFolder.inviteToken = generateRandomString(10);

        // Création du folder
        let savedFolder = await FolderRepository.save(newFolder);

        // Traitement de l'ajout d'amis (optionnel)
        if (friends && Array.isArray(friends)) {
            for (const friendUsername of friends) {
                // Rechercher l'utilisateur par son username
                const friendUser = await UserRepository.findOne({ where: { username: friendUsername } });
                if (!friendUser) {
                    return res.status(Code.NOT_FOUND).send(error(`Friend with username "${friendUsername}" not found`));
                }
                // On ne peut pas ajouter le propriétaire comme ami
                if (friendUser.id === user.id) continue;
                // Vérifier que l'utilisateur n'est pas déjà invité
                const existingJoin = await JoinedFolderRepository.findOne({
                    where: { folder: { id: savedFolder.id }, user: { id: friendUser.id } }
                });
                if (!existingJoin) {
                    const join = new JoinedFolderEntity();
                    join.folder = savedFolder;
                    join.user = friendUser;
                    join.userID = friendUser.id;
                    join.joinDate = new Date();
                    await JoinedFolderRepository.save(join);
                }
            }
        }

        const folderWithJoins = await FolderRepository.findOne({
            where: { id: savedFolder.id },
            relations: {
                joinedUser: {
                    user: true
                }
            }
        });

        const mappedFolder = {
            ...folderWithJoins,
            joinedUser: folderWithJoins.joinedUser?.map(j => j.user) || []
        };

        res.status(Code.CREATED).send(mappedFolder);
    } catch (e) {
        ErrorHandler(e, req, res);
    }
});

/**
 * Modifier un folder (propriétaire uniquement) avec possibilité d'ajouter des amis via leur username.
 */
folderRouter.put('/:id', apiTokenMiddleware, async (req, res) => {
    /*
        #swagger.tags = ['Folder']
        #swagger.path = '/folders/{id}'
        #swagger.method = 'put'
        #swagger.description = 'Update folder details (owner only). Optionnellement, ajoutez des amis via leur username (tableau "friends").'
        #swagger.parameters['id'] = {
            in: 'path',
            description: 'ID of the folder to update',
            required: true,
            type: 'integer'
        }
        #swagger.parameters['body'] = {
            in: 'body',
            description: 'Folder update data',
            required: true,
            schema: {
                name: "Updated folder name",
                friends: ["username1", "username2"]
            }
        }
        #swagger.responses[200] = {
            description: 'Folder updated successfully.',
            schema: { $ref: '#/definitions/Folder' }
        }
        #swagger.responses[403] = {
            description: 'Unauthorized to update this folder.',
            schema: {
                status: 403,
                msg: 'Vous n\'êtes pas autorisé à modifier ce folder'
            }
        }
        #swagger.responses[404] = {
            description: 'Folder not found.',
            schema: {
                status: 404,
                msg: 'Folder not found'
            }
        }
    */
    try {
        const { id } = req.params;
        const { name, friends } = req.body;
        const user: User = res.locals.connectedUser;

        // Charger le folder avec ses relations déjà présentes
        const folder = await FolderRepository.findOne({
            where: { id: Number(id) },
            relations: ["joinedUser"]
        });
        if (!folder) {
            return res.status(Code.NOT_FOUND).send(error(ResponseMessage.FOLDER_NOT_FOUND));
        }
        if (folder.userID !== user.id) {
            return res.status(Code.FORBIDDEN).send(error(ResponseMessage.UNAUTHORIZED_UPDATE_FOLDER));
        }

        if (name !== undefined) {
            folder.name = name;
        }

        // Traitement de l'ajout d'amis (optionnel)
        if (friends && Array.isArray(friends)) {
            const userRepo = getRepository(User);
            for (const friendUsername of friends) {
                const friendUser = await userRepo.findOne({ where: { username: friendUsername } });
                if (!friendUser) {
                    return res.status(Code.NOT_FOUND).send(error(`Friend with username "${friendUsername}" not found`));
                }
                // On ignore si c'est le propriétaire
                if (friendUser.id === user.id) continue;
                // Vérifier l'existence d'une invitation déjà présente
                const existingJoin = await JoinedFolderRepository.findOne({
                    where: { folder: { id: folder.id }, user: { id: friendUser.id } }
                });
                if (!existingJoin) {
                    const join = new JoinedFolderEntity();
                    join.folder = folder;
                    join.user = friendUser;
                    join.userID = friendUser.id;
                    join.joinDate = new Date();
                    await JoinedFolderRepository.save(join);
                }
            }
        }

        const updatedFolder = await FolderRepository.save(folder);

        // Recharger le folder avec les relations pour remapper joinedUser
        const folderWithJoins = await FolderRepository.findOne({
            where: { id: updatedFolder.id },
            relations: ["joinedUser", "joinedUser.user"]
        });
        const mappedFolder = {
            ...folderWithJoins,
            joinedUser: folderWithJoins.joinedUser?.map(j => j.user) || []
        };

        res.status(Code.OK).send(mappedFolder);
    } catch (e) {
        ErrorHandler(e, req, res);
    }
});

// --- Les autres routes restent inchangées ---

folderRouter.get('/', apiTokenMiddleware, async (req, res) => {
    /*
        #swagger.tags = ['Folder']
        #swagger.path = '/folders'
        #swagger.method = 'get'
        #swagger.description = 'Get folders accessible by the user (owner or invited).'
        #swagger.responses[200] = {
            description: 'Folders retrieved successfully.',
            schema: [{
                $ref: '#/definitions/Folder'
            }]
        }
    */
    try {
        const user: User = res.locals.connectedUser;

        const folders = await FolderRepository.createQueryBuilder("folder")
            .leftJoin("folder.joinedUser", "joined")
            .where("folder.userID = :userId", { userId: user.id })
            .orWhere("joined.userID = :userId", { userId: user.id })
            .getMany();

        const foldersWithMappedUsers = folders.map(folder => ({
            ...folder,
            joinedUser: folder.joinedUser?.map(j => j.user) || []
        }));

        res.status(Code.OK).send(foldersWithMappedUsers);
    } catch (e) {
        ErrorHandler(e, req, res);
    }
});

folderRouter.delete('/:id', apiTokenMiddleware, async (req, res) => {
    /*
        #swagger.tags = ['Folder']
        #swagger.path = '/folders/{id}'
        #swagger.method = 'delete'
        #swagger.description = 'Delete a folder (owner only).'
        #swagger.parameters['id'] = {
            in: 'path',
            description: 'ID of the folder to delete',
            required: true,
            type: 'integer'
        }
        #swagger.responses[204] = {
            description: 'Folder deleted successfully.'
        }
        #swagger.responses[403] = {
            description = 'Unauthorized to delete this folder.',
            schema: {
                status: 403,
                msg: 'Vous n\'êtes pas autorisé à supprimer ce folder'
            }
        }
        #swagger.responses[404] = {
            description: 'Folder not found.',
            schema: {
                status: 404,
                msg: 'Folder not found'
            }
        }
    */
    try {
        const { id } = req.params;
        const user: User = res.locals.connectedUser;

        const folder = await FolderRepository.findOne({ where: { id: Number(id) } });
        if (!folder) {
            return res.status(Code.NOT_FOUND).send(error(ResponseMessage.FOLDER_NOT_FOUND));
        }
        if (folder.userID !== user.id) {
            return res.status(Code.FORBIDDEN).send(error(ResponseMessage.UNAUTHORIZED_DELETE_FOLDER));
        }

        await FolderRepository.remove(folder);
        res.status(Code.NO_CONTENT).send();
    } catch (e) {
        ErrorHandler(e, req, res);
    }
});

folderRouter.post('/quit/:id', apiTokenMiddleware, async (req, res) => {
    /*
        #swagger.tags = ['Folder']
        #swagger.path = '/folders/quit/{id}'
        #swagger.method = 'post'
        #swagger.description = 'Leave a folder (if not the owner).'
        #swagger.parameters['id'] = {
            in: 'path',
            description: 'ID of the folder to leave',
            required: true,
            type: 'integer'
        }
        #swagger.responses[204] = {
            description: 'Left the folder successfully.'
        }
        #swagger.responses[400] = {
            description: 'Owner cannot leave his own folder.',
            schema: {
                status: 400,
                msg: 'Le propriétaire ne peut pas quitter le folder'
            }
        }
        #swagger.responses[404] = {
            description: 'Folder or membership not found.',
            schema: {
                status: 404,
                msg: 'Folder not found or you are not a member'
            }
        }
    */
    try {
        const { id } = req.params;
        const user: User = res.locals.connectedUser;

        const folder = await FolderRepository.findOne({ where: { id: Number(id) } });
        if (!folder) {
            return res.status(Code.NOT_FOUND).send(error(ResponseMessage.FOLDER_NOT_FOUND));
        }
        if (folder.userID === user.id) {
            return res.status(Code.BAD_REQUEST).send(error(ResponseMessage.OWNER_CANNOT_QUIT_FOLDER));
        }

        const joinedFolder = await JoinedFolderRepository.findOne({
            where: { folder: { id: folder.id }, user: { id: user.id } }
        });
        if (!joinedFolder) {
            return res.status(Code.NOT_FOUND).send(error(ResponseMessage.FOLDER_NOT_FOUND_OR_NOT_MEMBER));
        }

        await JoinedFolderRepository.delete(joinedFolder);
        res.status(Code.NO_CONTENT).send();
    } catch (e) {
        ErrorHandler(e, req, res);
    }
});

folderRouter.post('/share/:id', apiTokenMiddleware, async (req, res) => {
    /*
        #swagger.tags = ['Folder']
        #swagger.path = '/folders/share/{id}'
        #swagger.method = 'post'
        #swagger.description = 'Generate an invite token for a folder (owner only).'
        #swagger.parameters['id'] = {
            in: 'path',
            description: 'ID of the folder for which to generate an invite token',
            required: true,
            type: 'integer'
        }
        #swagger.responses[200] = {
            description: 'Invite token generated successfully.',
            schema: {
                inviteToken: 'string'
            }
        }
        #swagger.responses[403] = {
            description: 'Unauthorized to generate invite token for this folder.',
            schema: {
                status: 403,
                msg: 'Seul le propriétaire peut générer un lien d\'invitation'
            }
        }
        #swagger.responses[404] = {
            description: 'Folder not found.',
            schema: {
                status: 404,
                msg: 'Folder not found'
            }
        }
    */
    try {
        const { id } = req.params;
        const user: User = res.locals.connectedUser;

        const folder = await FolderRepository.findOne({ where: { id: Number(id) } });
        if (!folder) {
            return res.status(Code.NOT_FOUND).send(error(ResponseMessage.FOLDER_NOT_FOUND));
        }
        if (folder.userID !== user.id) {
            return res.status(Code.FORBIDDEN).send(error(ResponseMessage.UNAUTHORIZED_SHARE_FOLDER));
        }

        folder.inviteToken = generateRandomString(10);
        await FolderRepository.save(folder);

        res.status(Code.OK).send({ inviteToken: folder.inviteToken });
    } catch (e) {
        ErrorHandler(e, req, res);
    }
});

folderRouter.post('/join', apiTokenMiddleware, async (req, res) => {
    /*
        #swagger.tags = ['Folder']
        #swagger.path = '/folders/join'
        #swagger.method = 'post'
        #swagger.description = 'Join a folder using an invitation token.'
        #swagger.parameters['body'] = {
            in: 'body',
            description: 'Invitation token data',
            required: true,
            schema: {
                inviteToken: "Invitation token"
            }
        }
        #swagger.responses[200] = {
            description: 'Folder joined successfully.',
            schema: {
                msg: 'Folder rejoint avec succès'
            }
        }
        #swagger.responses[400] = {
            description: 'User is already the owner or already a member of the folder.',
            schema: {
                status: 400,
                msg: 'You are already the owner or a member of this folder'
            }
        }
        #swagger.responses[404] = {
            description: 'Folder not found for the given token.',
            schema: {
                status: 404,
                msg: 'Folder not found for the given token'
            }
        }
    */
    try {
        const { inviteToken } = req.body;
        if (!inviteToken) {
            return res.status(Code.UNPROCESSABLE_ENTITY).send(error(ResponseMessage.MISSING_INVITE_TOKEN));
        }
        const user: User = res.locals.connectedUser;

        const folder = await FolderRepository.findOne({ where: { inviteToken } });
        if (!folder) {
            return res.status(Code.NOT_FOUND).send(error(ResponseMessage.FOLDER_NOT_FOUND_FOR_TOKEN));
        }
        if (folder.userID === user.id) {
            return res.status(Code.BAD_REQUEST).send(error(ResponseMessage.ALREADY_OWNER));
        }

        const existingJoin = await JoinedFolderRepository.findOne({
            where: { folder: { id: folder.id }, user: { id: user.id } }
        });
        if (existingJoin) {
            return res.status(Code.BAD_REQUEST).send(error(ResponseMessage.ALREADY_JOINED_FOLDER));
        }

        const join = new JoinedFolderEntity();
        join.folder = folder;
        join.user = user;
        join.userID = user.id;
        join.joinDate = new Date();

        await JoinedFolderRepository.save(join);
        res.status(Code.OK).send({ message: 'Folder rejoint avec succès' });
    } catch (e) {
        ErrorHandler(e, req, res);
    }
});

export { folderRouter };
