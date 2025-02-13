import express = require("express");
import {ErrorHandler} from "../utils/error/error-handler";
import {EventRepository} from "../database/repository/event.repository";
import {apiTokenMiddleware} from "../middlewares/checkApiToken";
import {User} from "../database/entity/user.entity";
import {Equal, getRepository} from "typeorm";
import {Event} from "../database/entity/event.entity";
import {CategoryRepository} from "../database/repository/category.repository";
import {randomUUID} from "crypto";
import {FolderRepository} from "../database/repository/folder.repository";
import {JoinedEventRepository} from "../database/repository/joined-event.repository";
import {JoinedEventEntity} from "../database/entity/joined-event.entity";
import {Code} from "../utils/Code";
import {ResponseMessage} from "../utils/ResponseMessage";
import {UserRepository} from "../database/repository/user.repository";
import {generateRandomString} from "../utils/global";

const eventRouter = express.Router();

const error = (message: string) => ({error: message});

/**
 * Créer un event avec possibilité d'ajouter des amis via leur username (tableau "friends")
 */
eventRouter.post('/', apiTokenMiddleware, async (req, res) => {
    /**
     #swagger.tags = ['Event']
     #swagger.path = '/events'
     #swagger.description = 'Create new event. Optionnellement, ajoutez des amis via leur username (tableau "friends").'
     #swagger.parameters['body'] = {
     in: 'body',
     schema: {
     name: "Event name",
     description: "Event description",
     folderID: false,
     recurrencePattern: {
     type: "string",
     enum: ["daily", "weekly", "monthly", "yearly"],
     example: "daily"
     },
     targetDate: "2024-01-01T00:00:00.000Z",
     categoryID: 1,
     friends: ["username1", "username2"]
     }
     }
     **/
    try {
        const {name, description, recurrencePattern, interval, targetDate, categoryID, folderID, friends, inviteToken} = req.body;
        if (!name || !recurrencePattern || !targetDate) {
            return res.status(Code.UNPROCESSABLE_ENTITY).send(error(ResponseMessage.MISSING_REQUIRED_FIELDS));
        }
        const user: User = res.locals.connectedUser;
        const newEvent = new Event();
        newEvent.name = name;
        newEvent.description = description;
        newEvent.recurrencePattern = recurrencePattern;
        newEvent.interval = interval;
        newEvent.targetDate = new Date(targetDate);
        newEvent.inviteToken = inviteToken ? inviteToken : generateRandomString(10);
        newEvent.user = user;

        if (folderID) {
            const folder = await FolderRepository.findOneOrFail({
                where: {id: folderID},
                relations: {joinedUser: true}
            });
            if (folder.userID !== user.id) {
                const isInvited = folder.joinedUser.some(invitation => invitation.userID === user.id);
                if (!isInvited) {
                    return res.status(Code.FORBIDDEN).send(error(ResponseMessage.UNAUTHORIZED_FOLDER_ASSIGNMENT));
                }
            }
            newEvent.folder = folder;
        }

        if (categoryID) {
            const category = await CategoryRepository.findOne({where: {id: categoryID}});
            if (!category) {
                return res.status(Code.NOT_FOUND).send(error(ResponseMessage.CATEGORY_NOT_FOUND));
            }
            newEvent.category = category;
        }

        // Sauvegarder l'event
        let savedEvent = await EventRepository.save(newEvent);

        // Traitement optionnel de l'ajout d'amis via "friends"
        if (friends && Array.isArray(friends)) {
            for (const friendUsername of friends) {
                const friendUser = await UserRepository.findOne({where: {username: friendUsername}});
                if (!friendUser) {
                    return res.status(Code.NOT_FOUND).send(error(`Friend with username "${friendUsername}" not found`));
                }
                // Ne pas ajouter le créateur lui-même
                if (friendUser.id === user.id) continue;
                // Vérifier qu'il n'existe pas déjà une invitation pour cet utilisateur
                const existingJoin = await JoinedEventRepository.findOne({
                    where: {event: {id: savedEvent.id}, user: {id: friendUser.id}}
                });
                if (!existingJoin) {
                    const join = new JoinedEventEntity();
                    join.event = savedEvent;
                    join.user = friendUser;
                    join.joinDate = new Date();
                    await JoinedEventRepository.save(join);
                }
            }
        }

        // Recharger l'event avec ses relations pour remapper joinedUser
        const eventWithJoins = await EventRepository.findOne({
            where: { id: savedEvent.id },
            relations: {
                joinedUser: {
                    user: true
                }
            }
        });
        const mappedEvent = {
            ...eventWithJoins,
            joinedUser: eventWithJoins.joinedUser?.map(j => j.user) || []
        };

        res.status(Code.CREATED).send(mappedEvent);
    } catch (e) {
        ErrorHandler(e, req, res);
    }
});

/**
 * Modifier un event avec possibilité d'ajouter des amis via leur username (tableau "friends")
 */
eventRouter.put('/:id', apiTokenMiddleware, async (req, res) => {
    /**
     #swagger.tags = ['Event']
     #swagger.path = '/events/{id}'
     #swagger.description = 'Update event. Optionnellement, ajoutez des amis via leur username (tableau "friends").'
     #swagger.parameters['body'] = {
     in: 'body',
     schema: {
     name: "Updated event name",
     description: "Updated event description",
     recurrencePattern: "weekly",
     interval: 2,
     targetDate: "2024-02-01T00:00:00.000Z",
     categoryID: 2,
     friends: ["username1", "username2"]
     }
     }
     **/
    try {
        const {id} = req.params;
        const {name, description, recurrencePattern, interval, targetDate, categoryID, friends} = req.body;
        const user: User = res.locals.connectedUser;

        const event = await EventRepository.findOne({
            where: {id: Number(id), user: {id: Equal(user.id)}},
            relations: {category: true, joinedUser: true}
        });
        if (!event) {
            return res.status(Code.NOT_FOUND).send(error(ResponseMessage.EVENT_NOT_FOUND));
        }

        if (name !== undefined) event.name = name;
        if (description !== undefined) event.description = description;
        if (recurrencePattern !== undefined) event.recurrencePattern = recurrencePattern;
        if (interval !== undefined) event.interval = interval;
        if (targetDate !== undefined) event.targetDate = new Date(targetDate);

        if (categoryID !== undefined) {
            const category = await CategoryRepository.findOne({where: {id: categoryID}});
            if (!category) {
                return res.status(Code.NOT_FOUND).send(error(ResponseMessage.CATEGORY_NOT_FOUND));
            }
            event.category = category;
        }

        // Traitement optionnel de l'ajout d'amis via "friends"
        if (friends && Array.isArray(friends)) {
            const userRepo = getRepository(User);
            for (const friendUsername of friends) {
                const friendUser = await userRepo.findOne({where: {username: friendUsername}});
                if (!friendUser) {
                    return res.status(Code.NOT_FOUND).send(error(`Friend with username "${friendUsername}" not found`));
                }
                // Ignorer si c'est le créateur
                if (friendUser.id === user.id) continue;
                // Vérifier qu'il n'existe pas déjà une invitation
                const existingJoin = await JoinedEventRepository.findOne({
                    where: {event: {id: event.id}, user: {id: friendUser.id}}
                });
                if (!existingJoin) {
                    const join = new JoinedEventEntity();
                    join.event = event;
                    join.user = friendUser;
                    join.joinDate = new Date();
                    await JoinedEventRepository.save(join);
                }
            }
        }

        const updatedEvent = await EventRepository.save(event);

        // Recharger l'event avec les relations pour remapper joinedUser
        const eventWithJoins = await EventRepository.findOne({
            where: {id: updatedEvent.id},
            relations: ["joinedUser", "joinedUser.user"]
        });
        const mappedEvent = {
            ...eventWithJoins,
            joinedUser: eventWithJoins.joinedUser?.map(j => j.user) || []
        };

        res.status(Code.OK).send(mappedEvent);
    } catch (e) {
        ErrorHandler(e, req, res);
    }
});

eventRouter.get('/', apiTokenMiddleware, async (req, res) => {
    /**
     #swagger.tags = ['Event']
     #swagger.path = '/events'
     #swagger.description = 'Get user events'
     **/
    try {
        const user: User = res.locals.connectedUser;

        const events = await EventRepository.createQueryBuilder("event")
            .leftJoinAndSelect("event.joinedUser", "joinedUser")
            .leftJoinAndSelect("event.user", "creator")
            .leftJoinAndSelect("joinedUser.user", "joinedUserUser")
            .leftJoinAndSelect("event.category", "category")
            .leftJoinAndSelect("event.folder", "folder")
            .leftJoinAndSelect("folder.joinedUser", "folderJoinedUser")
            .where("event.userID = :userId", {userId: user.id})
            .orWhere("joinedUserUser.id = :userId", {userId: user.id})
            .orWhere("folder.userID = :userId", {userId: user.id})
            .orWhere("folderJoinedUser.userID = :userId", {userId: user.id})
            .getMany();

        const eventsWithMappedUsers = events.map(event => ({
            ...event,
            joinedUser: event.joinedUser?.map(j => j.user) || []
        }));

        res.status(Code.OK).send(eventsWithMappedUsers);
    } catch (e) {
        ErrorHandler(e, req, res);
    }
});

eventRouter.delete('/:id', apiTokenMiddleware, async (req, res) => {
    /**
     #swagger.tags = ['Event']
     #swagger.path = '/events/{id}'
     #swagger.description = 'Delete event'
     **/
    try {
        const {id} = req.params;
        const user: User = res.locals.connectedUser;

        const event = await EventRepository.findOne({
            where: {id: Number(id), user: {id: Equal(user.id)}}
        });
        if (!event) {
            return res.status(Code.NOT_FOUND).send(error(ResponseMessage.EVENT_NOT_FOUND));
        }

        await EventRepository.remove(event);
        res.status(Code.NO_CONTENT).send();
    } catch (e) {
        ErrorHandler(e, req, res);
    }
});

eventRouter.post('/share/:id', apiTokenMiddleware, async (req, res) => {
    /**
     #swagger.tags = ['Event']
     #swagger.path = '/events/share/{id}'
     #swagger.description = 'Generate an invite token for an event (only for the event creator)'
     **/
    try {
        const {id} = req.params;
        const user: User = res.locals.connectedUser;

        const event = await EventRepository.findOne({
            where: {id: Number(id), user: {id: Equal(user.id)}}
        });
        if (!event) {
            return res.status(Code.NOT_FOUND).send(error(ResponseMessage.EVENT_NOT_FOUND_OR_NOT_OWNER));
        }

        event.inviteToken = generateRandomString(10);
        await EventRepository.save(event);

        res.status(Code.OK).send({inviteToken: event.inviteToken});
    } catch (e) {
        ErrorHandler(e, req, res);
    }
});

eventRouter.post('/join', apiTokenMiddleware, async (req, res) => {
    /**
     #swagger.tags = ['Event']
     #swagger.path = '/events/join'
     #swagger.method = 'post'
     #swagger.description = 'Rejoindre un event à l\'aide d\'un token d\'invitation.'
     #swagger.parameters['body'] = {
     in: 'body',
     description: 'Données du token d\'invitation',
     required: true,
     schema: {
     inviteToken: "Token d'invitation"
     }
     }
     #swagger.responses[200] = {
     description: 'Event rejoint avec succès.',
     schema: { message: 'Event rejoint avec succès' }
     }
     #swagger.responses[400] = {
     description: 'L\'utilisateur est déjà le créateur ou déjà membre de l\'event.',
     schema: { status: 400, error: 'Vous êtes déjà le propriétaire de cet event' }
     }
     #swagger.responses[404] = {
     description: 'Event introuvable pour le token fourni.',
     schema: { status: 404, error: 'Event not found for the given token' }
     }
     **/
    try {
        const {inviteToken} = req.body;
        if (!inviteToken) {
            return res.status(Code.UNPROCESSABLE_ENTITY).send(error(ResponseMessage.MISSING_INVITE_TOKEN));
        }
        const user: User = res.locals.connectedUser;

        const event = await EventRepository.findOne({
            where: {inviteToken},
            relations: {user: true}
        });
        if (!event) {
            return res.status(Code.NOT_FOUND).send(error(ResponseMessage.EVENT_NOT_FOUND_FOR_TOKEN));
        }
        if (event.user.id === user.id) {
            return res.status(Code.BAD_REQUEST).send(error(ResponseMessage.ALREADY_OWNER_EVENT));
        }

        const existingJoin = await JoinedEventRepository.findOne({
            where: {event: {id: event.id}, user: {id: user.id}}
        });
        if (existingJoin) {
            return res.status(Code.BAD_REQUEST).send(error(ResponseMessage.ALREADY_JOINED_EVENT));
        }

        const join = new JoinedEventEntity();
        join.event = event;
        join.user = user;
        join.joinDate = new Date();

        await JoinedEventRepository.save(join);
        res.status(Code.OK).send({message: 'Event rejoint avec succès'});
    } catch (e) {
        ErrorHandler(e, req, res);
    }
});

eventRouter.post('/leave/:id', apiTokenMiddleware, async (req, res) => {
    /**
     #swagger.tags = ['Event']
     #swagger.path = '/events/leave/{id}'
     #swagger.method = 'post'
     #swagger.description = 'Quitter un event (si l\'utilisateur n\'en est pas le créateur).'
     #swagger.parameters['id'] = {
     in: 'path',
     description: 'ID de l\'event à quitter',
     required: true,
     type: 'integer'
     }
     #swagger.responses[204] = {
     description: 'Event quitté avec succès.'
     }
     #swagger.responses[400] = {
     description: 'Le créateur ne peut pas quitter son propre event.',
     schema: { status: 400, error: 'Le propriétaire ne peut pas quitter cet event' }
     }
     #swagger.responses[404] = {
     description: 'Event introuvable ou l\'utilisateur n\'est pas membre.',
     schema: { status: 404, error: 'Event not found or you are not a member' }
     }
     **/
    try {
        const {id} = req.params;
        const user: User = res.locals.connectedUser;

        const event = await EventRepository.findOne({
            where: {id: Number(id)},
            relations: {user: true}
        });
        if (!event) {
            return res.status(Code.NOT_FOUND).send(error(ResponseMessage.EVENT_NOT_FOUND));
        }
        if (event.user.id === user.id) {
            return res.status(Code.BAD_REQUEST).send(error(ResponseMessage.OWNER_CANNOT_QUIT_EVENT));
        }

        const joinedEvent = await JoinedEventRepository.findOne({
            where: {event: {id: event.id}, user: {id: user.id}}
        });
        if (!joinedEvent) {
            return res.status(Code.NOT_FOUND).send(error(ResponseMessage.EVENT_NOT_FOUND_OR_NOT_MEMBER));
        }

        await JoinedEventRepository.remove(joinedEvent);
        res.status(Code.NO_CONTENT).send();
    } catch (e) {
        ErrorHandler(e, req, res);
    }
});

export {eventRouter};
