import express = require("express");
import { User } from "../database/entity/user.entity";
import { UserRepository } from "../database/repository/user.repository";
import { ErrorHandler } from "../utils/error/error-handler";
import { Equal } from "typeorm";
import { FriendsRequestRepository } from "../database/repository/friends-request.repository";
import { FriendsRequest } from "../database/entity/friends-request.entity";
import { FriendsRepository } from "../database/repository/friends.repository";
import { Friends } from "../database/entity/friends.entity";
import { statusMsg } from "../utils/global";
import { pleaseReload } from "../socket/pleaseReload";
import {apiTokenMiddleware} from "../middlewares/checkApiToken";

const friendsRouter = express.Router();

friendsRouter.post('/', apiTokenMiddleware, async (req, res) => {
    /**
        #swagger.tags = ['Friends']
        #swagger.path = '/friends-request/'
        #swagger.method = 'post'
        #swagger.description = 'Send a friend request to a user.'
        #swagger.parameters['body'] = {
            in: 'body',
            description: 'Username of the friends',
            required: true,
            schema: {
                searchField: 'azeraze#12345'
            }
        }
        #swagger.responses[200] = {
            description: 'Friend request sent successfully.',
            schema: {
                $ref: '#/definitions/FriendsRequest'
            }
        }
        #swagger.responses[404] = {
            description: 'User not found.',
            schema: { status: '404', msg: 'User not found.' }
        }
        #swagger.responses[422] = {
            description: 'Friend request already exists or they are already friends.',
            schema: { status: '422', msg: 'Already friends or request exists.' }
        }
    */
    try {
        let { searchField } = req.body;
        let user: User = res.locals.connectedUser;

        let userRequested = await UserRepository.findOneOrFail({
            where: [
                { username: Equal(searchField) },
            ]
        });

        let alreadyFriends = await FriendsRepository.areTheyFriends(user.id, userRequested.id);
        if (alreadyFriends) {
            return res.status(422).send('They are already friends');
        }

        let alreadyRequested = await FriendsRequestRepository.alreadyRequested(user.id, userRequested.id);
        if (alreadyRequested) {
            return res.status(422).send('Une requete d\'ami existe déjà');
        }

        let friendsRequest = new FriendsRequest();
        friendsRequest.asker = user;
        friendsRequest.receiver = userRequested;

        res.send(await FriendsRequestRepository.save(friendsRequest));

        pleaseReload(friendsRequest.receiver.id, 'friendRequest', 0);
    } catch (e) {
        return ErrorHandler(e, req, res);
    }
});

friendsRouter.delete('/', apiTokenMiddleware, async (req, res) => {
    /** #swagger.tags = ['Friends']
        #swagger.path = '/friends-request/{username}'
        #swagger.method = 'delete'
        #swagger.description = 'Remove a friend.'
        #swagger.parameters['body'] = {
            in: 'body',
            description: 'Username of the friends',
            required: true,
            schema: {
                field: 'azeraze#12345'
            }
        }
        #swagger.responses[200] = {
            description: 'Friend removed successfully.',
            schema: { status: '200', msg: 'Bien supprimé' }
        }
        #swagger.responses[404] = {
            description: 'User not found.',
            schema: { status: '404', msg: 'User not found.' }
        }
        #swagger.responses[422] = {
            description: 'Users are not friends.',
            schema: { status: '422', msg: 'They are not friends' }
        }
    */
    try {
        let username = req.body.field;
        let user: User = res.locals.connectedUser;

        let userRequested = await UserRepository.findOneByOrFail({
            username: Equal(username)
        });

        let alreadyFriends = await FriendsRepository.getFriends(user.id, userRequested.id);
        if (!alreadyFriends) {
            return res.status(422).send('They are no friends');
        }

        await FriendsRepository.remove(alreadyFriends);

        res.send(statusMsg(200, 'Bien supprimé'));

        pleaseReload([alreadyFriends.user1.id, alreadyFriends.user2.id], 'friend', 0);
    } catch (e) {
        return ErrorHandler(e, req, res);
    }
});

friendsRouter.get('/', apiTokenMiddleware, async (req, res) => {
    /*  #swagger.tags = ['Friends']
        #swagger.path = '/friends-request'
        #swagger.method = 'get'
        #swagger.description = 'Get friend requests for the logged-in user.'
        #swagger.responses[200] = {
            description: 'List of friend requests received by the logged-in user.',
            schema: [ {
                    $ref: '#/definitions/FriendsRequest'
                }
            ]
        }
    */
    try {
        let user: User = res.locals.connectedUser;

        let userRequests = await FriendsRequestRepository.find({
            where: {
                receiver: {
                    id: Equal(user.id)
                }
            },
            relations: {
                asker: true,
                receiver: true
            }
        });

        return res.send(userRequests);
    } catch (e) {
        return ErrorHandler(e, req, res);
    }
});

friendsRouter.put('/:requestId', apiTokenMiddleware, async (req, res) => {
    /*  #swagger.tags = ['Friends']
        #swagger.path = '/friends-request/{requestId}'
        #swagger.method = 'put'
        #swagger.description = 'Accept or decline a friend request.'
        #swagger.parameters['requestId'] = {
            in: 'path',
            description: 'ID of the friend request to accept or decline',
            required: true,
            example: 1
        }
        #swagger.parameters['body'] = {
            in: 'body',
            description: 'Friend request acceptance data',
            required: true,
            schema: {
                accept: true
            }
        }
        #swagger.responses[200] = {
            description: 'Friend request accepted successfully.',
            schema: {
                isAccepted: {
                    type: 'boolean'
                },
                user: {
                    $ref: '#/definitions/User'
                }
            }
        }
        #swagger.responses[404] = {
            description: 'Friend request not found.',
            schema: { status: '404', msg: 'Friend request not found.' }
        }
    */
    try {
        let requestId = parseInt(req.params.requestId);
        let user: User = res.locals.connectedUser;
        let { accept } = req.body;

        let friendRequest = await FriendsRequestRepository.findOneOrFail({
            where: {
                id: Equal(requestId),
                receiver: { id: Equal(user.id) }
            },
            relations: {
                asker: true,
                receiver: true
            }
        });

        let friends;
        if (accept) {
            friends = new Friends();
            friends.user1 = friendRequest.asker;
            friends.user2 = friendRequest.receiver;
            await FriendsRepository.save(friends);
        }

        await FriendsRequestRepository.remove(friendRequest);

        res.send({
            isAccepted: accept,
            user: friendRequest.asker
        });

        if (accept) {
            pleaseReload(friends.user1.id, 'friend', 0);
        }
    } catch (e) {
        return ErrorHandler(e, req, res);
    }
});

friendsRouter.get('/sent', apiTokenMiddleware, async (req, res) => {
    /*  #swagger.tags = ['Friends']
        #swagger.path = '/friends-request/sent'
        #swagger.method = 'get'
        #swagger.description = 'Get friend requests sent by the logged-in user.'
        #swagger.responses[200] = {
            description: 'List of friend requests sent by the logged-in user.',
            schema: [ {
                    $ref: '#/definitions/FriendsRequest'
                }
            ]
        }
    */
    try {
        let user: User = res.locals.connectedUser;

        let sentRequests = await FriendsRequestRepository.getPendingRequests(user.id);

        return res.send(sentRequests);
    } catch (e) {
        return ErrorHandler(e, req, res);
    }
});


friendsRouter.delete('/sent/:requestId', apiTokenMiddleware, async (req, res) => {
    /*  #swagger.tags = ['Friends']
        #swagger.path = '/friends-request/sent/{requestId}'
        #swagger.method = 'delete'
        #swagger.description = 'Delete a sent friend request.'
        #swagger.parameters['requestId'] = {
            in: 'path',
            description: 'ID of the friend request to delete',
            required: true,
            example: 1
        }
        #swagger.responses[200] = {
            description: 'Friend request deleted successfully.',
            schema: { status: '200', msg: 'Friend request deleted successfully.' }
        }
        #swagger.responses[404] = {
            description: 'Friend request not found.',
            schema: { status: '404', msg: 'Friend request not found.' }
        }
    */
    try {
        let requestId = parseInt(req.params.requestId);
        let user: User = res.locals.connectedUser;

        let friendRequest = await FriendsRequestRepository.findOneOrFail({
            where: {
                id: Equal(requestId),
                asker: { id: Equal(user.id) }
            },
            relations: {
                asker: true,
                receiver: true
            }
        });

        await FriendsRequestRepository.remove(friendRequest);

        res.send(statusMsg(200, 'Friend request deleted successfully.'));
    } catch (e) {
        return ErrorHandler(e, req, res);
    }
});


export { friendsRouter };
