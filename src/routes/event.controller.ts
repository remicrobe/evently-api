import express = require("express");
import { ErrorHandler } from "../utils/error/error-handler";
import { EventRepository } from "../database/repository/event.repository";
import { apiTokenMiddleware } from "../middlewares/checkApiToken";
import { User } from "../database/entity/user.entity";
import {Brackets, Equal, In, Not} from "typeorm";
import { Event } from "../database/entity/event.entity";
import { CategoryRepository } from "../database/repository/category.repository";
import { FolderRepository } from "../database/repository/folder.repository";
import { JoinedEventRepository } from "../database/repository/joined-event.repository";
import { InvitationStatus, JoinedEventEntity } from "../database/entity/joined-event.entity";
import { Code } from "../utils/Code";
import { ResponseMessage } from "../utils/ResponseMessage";
import { UserRepository } from "../database/repository/user.repository";
import { generateRandomString } from "../utils/global";

const eventRouter = express.Router();
const error = (message: string) => ({ error: message });

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
        const { name, description, recurrencePattern, interval, targetDate, categoryID, folderID, friends, inviteToken } = req.body;
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
                where: { id: folderID },
                relations: { joinedUser: true }
            });
            if (folder.userID !== user.id && !folder.joinedUser.some(inv => inv.userID === user.id)) {
                return res.status(Code.FORBIDDEN).send(error(ResponseMessage.UNAUTHORIZED_FOLDER_ASSIGNMENT));
            }
            newEvent.folder = folder;
        }

        if (categoryID) {
            const category = await CategoryRepository.findOne({ where: { id: categoryID } });
            if (!category) {
                return res.status(Code.NOT_FOUND).send(error(ResponseMessage.CATEGORY_NOT_FOUND));
            }
            newEvent.category = category;
        }

        let savedEvent = await EventRepository.save(newEvent);

        if (friends && Array.isArray(friends)) {
            for (const friendUsername of friends) {
                const friendUser = await UserRepository.findOne({ where: { username: friendUsername } });
                if (!friendUser) {
                    return res.status(Code.NOT_FOUND).send(error(`Friend with username "${friendUsername}" not found`));
                }
                if (friendUser.id === user.id) continue;
                const existingJoin = await JoinedEventRepository.findOne({
                    where: { event: { id: savedEvent.id }, user: { id: friendUser.id } }
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

        const eventWithJoins = await EventRepository.findOne ({
            where: { id: savedEvent.id },
            relations: {
                user: true,
                joinedUser: { user: true } ,
                category: true,
                folder: true
            }
        });

        await EventRepository.advertUser(eventWithJoins.id)

        res.status(Code.CREATED).send(eventWithJoins);
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
        const { id } = req.params;
        const { name, description, recurrencePattern, interval, targetDate, categoryID, friends, folderID } = req.body;
        const user: User = res.locals.connectedUser;

        const event = await EventRepository.findOne({
            where: { id: Number(id), user: { id: Equal(user.id) } },
            relations: { category: true, joinedUser: { user: true } }
        });
        if (!event) {
            return res.status(Code.NOT_FOUND).send(error(ResponseMessage.EVENT_NOT_FOUND));
        }

        if (name !== undefined) event.name = name;
        if (description !== undefined) event.description = description;
        if (recurrencePattern !== undefined) event.recurrencePattern = recurrencePattern;
        if (interval !== undefined) event.interval = interval;
        if (targetDate !== undefined) event.targetDate = new Date(targetDate);

        if (folderID) {
            const folder = await FolderRepository.findOneOrFail({
                where: { id: folderID },
                relations: { joinedUser: true }
            });
            if (folder.userID !== user.id && !folder.joinedUser.some(inv => inv.userID === user.id)) {
                return res.status(Code.FORBIDDEN).send(error(ResponseMessage.UNAUTHORIZED_FOLDER_ASSIGNMENT));
            }
            event.folder = folder;
        } else {
            event.folder = null;
            event.folderID = null;
        }

        if (categoryID !== undefined) {
            const category = await CategoryRepository.findOne({ where: { id: categoryID } });
            if (!category) {
                return res.status(Code.NOT_FOUND).send(error(ResponseMessage.CATEGORY_NOT_FOUND));
            }
            event.category = category;
        }

        const updatedEvent = await EventRepository.save(event);

        if (friends && Array.isArray(friends)) {
            const jeToDelete = await JoinedEventRepository.findBy({
                user: {
                    username: Not(In(friends))
                },
                eventId: event.id
            });

            await JoinedEventRepository.remove(jeToDelete);

            for (const friendUsername of friends) {
                const friendUser = await UserRepository.findOne({ where: { username: friendUsername } });
                if (!friendUser) {
                    return res.status(Code.NOT_FOUND).send(error(`Friend with username "${friendUsername}" not found`));
                }
                if (friendUser.id === user.id) continue;
                const existingJoin = await JoinedEventRepository.findOne({
                    where: { event: { id: event.id }, user: { id: friendUser.id } }
                });
                if (!existingJoin) {
                    const join = new JoinedEventEntity();
                    join.eventId = event.id;
                    join.user = friendUser;
                    join.joinDate = new Date();
                    await JoinedEventRepository.insert(join);
                }
            }
        } else {
            await JoinedEventRepository.delete({
                eventId: Equal(event.id)
            })
        }

        const eventWithJoins = await EventRepository.findOne({
            where: { id: updatedEvent.id },
            relations: {
                user: true,
                joinedUser: {
                    user: true
                },
                category: true,
                folder: true
            }
        });

        await EventRepository.advertUser(eventWithJoins.id, 'update')

        res.status(Code.OK).send(eventWithJoins);
    } catch (e) {
        ErrorHandler(e, req, res);
    }
});

/**
 * Delete event
 */
eventRouter.delete('/:id', apiTokenMiddleware, async (req, res) => {
    /**
     #swagger.tags = ['Event']
     #swagger.path = '/events/{id}'
     #swagger.description = 'Delete event'
     **/
    try {
        const { id } = req.params;
        const user: User = res.locals.connectedUser;

        const event = await EventRepository.findOne({
            where: { id: Number(id), user: { id: Equal(user.id) } },
            relations: ["user", "joinedUser", "joinedUser.user"]
        });
        if (!event) {
            return res.status(Code.NOT_FOUND).send(error(ResponseMessage.EVENT_NOT_FOUND));
        }

        await EventRepository.advertUser(event.id, 'delete')

        await EventRepository.remove(event);

        res.status(Code.NO_CONTENT).send();
    } catch (e) {
        ErrorHandler(e, req, res);
    }
});

/**
 * Rejoindre un event à l'aide d'un token d'invitation.
 */
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
        const { inviteToken } = req.body;
        if (!inviteToken) {
            return res.status(Code.UNPROCESSABLE_ENTITY).send(error(ResponseMessage.MISSING_INVITE_TOKEN));
        }
        const user: User = res.locals.connectedUser;

        const event = await EventRepository.findOne({
            where: { inviteToken },
            relations: { user: true }
        });
        if (!event) {
            return res.status(Code.NOT_FOUND).send(error(ResponseMessage.EVENT_NOT_FOUND_FOR_TOKEN));
        }
        if (event.user.id === user.id) {
            return res.status(Code.BAD_REQUEST).send(error(ResponseMessage.ALREADY_OWNER_EVENT));
        }

        const existingJoin = await JoinedEventRepository.findOne({
            where: { event: { id: event.id }, user: { id: user.id } }
        });
        if (existingJoin) {
            return res.status(Code.BAD_REQUEST).send(error(ResponseMessage.ALREADY_JOINED_EVENT));
        }

        const join = new JoinedEventEntity();
        join.event = event;
        join.user = user;
        join.joinDate = new Date();
        join.invitationStatus = InvitationStatus.ACCEPTED;

        await JoinedEventRepository.save(join);
        const updatedEvent = await EventRepository.findOne({
            where: { id: event.id },
            relations: {
                user: true,
                joinedUser: {
                    user: true
                },
                folder: true,
                category: true
            }
        });

        await JoinedEventRepository.advertUser(event.id, join);

        res.status(Code.OK).send(updatedEvent);
    } catch (e) {
        ErrorHandler(e, req, res);
    }
});

/**
 * Quitter un event (si l'utilisateur n'en est pas le créateur).
 */
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
        const { id } = req.params;
        const user: User = res.locals.connectedUser;

        const event = await EventRepository.findOne({
            where: { id: Number(id) },
            relations: ["user", "joinedUser", "joinedUser.user"]
        });
        if (!event) {
            return res.status(Code.NOT_FOUND).send(error(ResponseMessage.EVENT_NOT_FOUND));
        }
        if (event.user.id === user.id) {
            return res.status(Code.BAD_REQUEST).send(error(ResponseMessage.OWNER_CANNOT_QUIT_EVENT));
        }

        const joinedEvent = await JoinedEventRepository.findOne({
            where: { event: { id: event.id }, user: { id: user.id } }
        });
        if (!joinedEvent) {
            return res.status(Code.NOT_FOUND).send(error(ResponseMessage.EVENT_NOT_FOUND_OR_NOT_MEMBER));
        }

        await JoinedEventRepository.advertUser(event.id, joinedEvent);

        await JoinedEventRepository.remove(joinedEvent);

        res.status(Code.NO_CONTENT).send();
    } catch (e) {
        ErrorHandler(e, req, res);
    }
});

/**
 * Nouvelle route : Récupérer les invitations à traiter (status "invited" ou "pending")
 */
eventRouter.get('/invitation', apiTokenMiddleware, async (req, res) => {
    /**
     * #swagger.tags = ['Event']
     * #swagger.path = '/events/invitation'
     * #swagger.description = 'Récupérer les invitations à traiter pour l’utilisateur (status "invited" ou "pending").'
     **/
    try {
        const user: User = res.locals.connectedUser;
        const invitations = await JoinedEventRepository.find({
            where: {
                user: { id: user.id },
                invitationStatus: In([InvitationStatus.INVITED, InvitationStatus.PENDING])
            },
            relations: { event: { user: true, category: true } }
        });
        res.status(Code.OK).send(invitations);
    } catch (e) {
        ErrorHandler(e, req, res);
    }
});

/**
 * Nouvelle route : Mettre à jour le status d'une invitation.
 * L'utilisateur peut ainsi accepter ("accepted"), la laisser en attente ("pending")
 * ou refuser ("refused") son invitation (ce qui supprime l'enregistrement).
 */
eventRouter.put('/invitation/:eventId', apiTokenMiddleware, async (req, res) => {
    /**
     * #swagger.tags = ['Event']
     * #swagger.path = '/events/invitation/{eventId}'
     * #swagger.description = 'Mettre à jour le status d\'une invitation pour un event. Fournir un status : "accepted", "pending" ou "refused" (le refus mène à la suppression de l\'invitation).'
     * #swagger.parameters['eventId'] = {
     *   in: 'path',
     *   description: 'ID de l\'event',
     *   required: true,
     *   type: 'integer'
     * }
     * #swagger.parameters['body'] = {
     *   in: 'body',
     *   schema: {
     *     status: "accepted" // accepted, pending, ou refused
     *   }
     * }
     **/
    try {
        const { eventId } = req.params;
        const { status } = req.body;
        const user: User = res.locals.connectedUser;
        const validStatuses = ["accepted", "pending", "refused"];
        if (!status || !validStatuses.includes(status)) {
            return res.status(Code.UNPROCESSABLE_ENTITY).send(error("Le status doit être l'une des valeurs suivantes : accepted, pending, refused"));
        }
        // Récupérer l'enregistrement d'invitation correspondant à cet event et à l'utilisateur connecté
        const joinRecord = await JoinedEventRepository.findOne({
            where: {
                event: { id: Number(eventId) },
                user: { id: user.id }
            },
            relations: {
                event: {
                    user: true,
                    joinedUser: {
                        user: true
                    },
                    folder: true,
                    category: true
                }
            }
        });
        if (!joinRecord) {
            return res.status(Code.NOT_FOUND).send(error("Invitation not found"));
        }

        if (status === "refused") {
            await JoinedEventRepository.remove(joinRecord);
            return res.status(Code.OK).send({ message: "Invitation refusée et supprimée" });
        } else {
            joinRecord.invitationStatus = status === "accepted" ? InvitationStatus.ACCEPTED : InvitationStatus.PENDING;
            await JoinedEventRepository.save(joinRecord);
            await JoinedEventRepository.advertUser(joinRecord.eventId, joinRecord);

            return res.status(Code.OK).send({
                joinRecord
            });
        }
    } catch (e) {
        ErrorHandler(e, req, res);
    }
});

eventRouter.get('/by-invite/:token', apiTokenMiddleware, async (req, res) => {
    /**
     #swagger.tags = ['Event']
     #swagger.path = '/events/by-invite/{token}'
     #swagger.description = 'Return full event entity'
     **/
    try {
        const { token } = req.params;

        const event = await EventRepository.findOne({
            where: { inviteToken: Equal(token) },
            relations: {
                user: true,
                joinedUser: {
                    user: true
                },
                category: true,
                folder: true
            }
        });

        res.send(event);
    } catch (e) {
        ErrorHandler(e, req, res);
    }
})

/**
 * Get user events
 */
eventRouter.get('/:id?', apiTokenMiddleware, async (req, res) => {
    /**
     #swagger.tags = ['Event']
     #swagger.path = '/events/{id}'
     #swagger.description = 'Get user events or a specific event when if is req'
     **/
    try {
        const user: User = res.locals.connectedUser;
        const id = req.params.id;

        const query = EventRepository.createQueryBuilder("event")
            .leftJoinAndSelect("event.joinedUser", "joinedUser")
            .leftJoinAndSelect("event.user", "creator")
            .leftJoinAndSelect("joinedUser.user", "joinedUserUser")
            .leftJoinAndSelect("event.category", "category")
            .leftJoinAndSelect("event.folder", "folder")
            .leftJoinAndSelect("folder.joinedUser", "folderJoinedUser")
            .orderBy('event.targetDate', 'ASC')

        query.where(new Brackets(qb => {
                qb.where("event.userID = :userId", { userId: user.id })
                .orWhere("joinedUserUser.id = :userId AND joinedUser.invitationStatus = :accepted", { userId: user.id, accepted: InvitationStatus.ACCEPTED })
                .orWhere("folder.userID = :userId", { userId: user.id })
                .orWhere("folderJoinedUser.userID = :userId", { userId: user.id })
        }))

        if (id) {
            query.andWhere('event.id = :id', { id })
        }

        const events = await query.getMany();

        res.status (Code.OK).send (
            id
                ? events[ 0 ]
                : events
        );
    } catch (e) {
        ErrorHandler(e, req, res);
    }
});

export { eventRouter };
