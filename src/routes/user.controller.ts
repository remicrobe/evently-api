import express = require("express");
import { User } from "../database/entity/user.entity";
import { checkRequiredField, statusMsg } from "../utils/global";
import { createHash } from "crypto";
import { Equal } from "typeorm";
import { ErrorHandler } from "../utils/error/error-handler";
import { UserRepository } from "../database/repository/user.repository";
import { verifyJwt } from "../utils/jwt/verify";
import { generateJwt } from "../utils/jwt/generate";
import { rateLimiterMiddleware } from "../middlewares/rateLimiter";
import { apiTokenMiddleware } from "../middlewares/checkApiToken";
import { FriendsRepository } from "../database/repository/friends.repository";

const userRouter = express.Router ();

userRouter.get ('/friends', apiTokenMiddleware, async (req, res) => {
    /** #swagger.tags = ['User']
     #swagger.path = '/user/friends'
     #swagger.description = 'Get user friends.'
     #swagger.responses[200] = {
     description: 'User friends retrieved successfully.',
     schema: [{
     $ref: '#/definitions/User'
     }]
     }
     }
     */
    let user: User = res.locals.connectedUser;

    let userFriends = await FriendsRepository.findFriends (user.id);
    let friends: User[] = []

    for (let friend of userFriends) {
        if (friend.user1.id === user.id) friends.push (friend.user2)
        else friends.push (friend.user1)
    }

    return res.send (friends);
});

userRouter.get ('/me', apiTokenMiddleware, async (req, res) => {
    /** #swagger.tags = ['User']
     #swagger.path = '/user/me'
     #swagger.method = 'get'
     #swagger.description = 'Get all information of the connected user.'
     #swagger.responses[200] = {
     description: 'User information retrieved successfully.',
     schema: {
     $ref: '#/definitions/User'
     }
     }
     #swagger.responses[401] = {
     description: 'Unauthorized. No valid token provided.',
     schema: {
     status: 401,
     msg: 'Unauthorized.'
     }
     }
     */
    let user: User = res.locals.connectedUser;

    return res.send (user);
});

userRouter.delete ('/', apiTokenMiddleware, async (req, res) => {
    /** #swagger.tags = ['User']
     #swagger.path = '/user/'
     #swagger.method = 'delete'
     #swagger.description = 'Delete an User.'
     #swagger.responses[200] = {
     description: 'User information deleted successfully.',
     schema: {
     msg: '',
     status: 200
     }
     }
     #swagger.responses[401] = {
     description: 'Unauthorized. No valid token provided.',
     schema: {
     status: 401,
     msg: 'Unauthorized.'
     }
     }
     */
    let user: User = res.locals.connectedUser;

    user.deletedAt = new Date ();
    user.isDeleted = true;

    await UserRepository.save (user);

    return res.send (statusMsg (200, 'User bien supprimé'));
});

userRouter.post ('/register', rateLimiterMiddleware (60 * 15, 5), async (req, res) => {
    /** #swagger.tags = ['User']
     #swagger.path = '/user/register'
     #swagger.description = 'Register a new user.'
     #swagger.parameters['body'] = {
     in: 'body',
     description: 'User registration data',
     required: true,
     schema: {
     $ref: '#/definitions/User'
     }
     }
     */
    let { email, password, firstName, lastName } = req.body;

    if (!checkRequiredField ([
        { type: 'mail', object: email },
        { type: 'password', object: password },
        firstName,
        lastName
    ])) {
        return res.sendStatus (422);
    }

    let user = UserRepository.createUser (
        email,
        createHash ('sha256').update (password).digest ('hex'),
        "evently_api",
        true
    )

    user.username = `${ firstName }${ lastName }`.toLowerCase () + '#' + Math.floor (1000 + Math.random () * 9000);
    user.username = user.username.normalize ("NFD").replace (/[\u0300-\u036f]/g, "").replace (" ", "")
    user.firstName = firstName;
    user.lastName = lastName;

    let createdUser = await UserRepository.save (user);

    return res.send ({
        ...createdUser,
        token: generateJwt ("token", createdUser.id),
        refreshToken: generateJwt ("refreshToken", createdUser.id)
    });
});

userRouter.put ('/', apiTokenMiddleware, async (req, res) => {
    /**  #swagger.tags = ['User']
     #swagger.path = '/user/'
     #swagger.description = 'Update user details.'
     #swagger.parameters['body'] = {
     in: 'body',
     description: 'User update data',
     required: true,
     schema: {
     $ref: '#/definitions/User'
     }
     }
     #swagger.responses[200] = {
     description: 'User updated successfully.',
     schema: {
     $ref: '#/definitions/User'
     }
     }
     #swagger.responses[404] = {
     description: 'User not found.',
     schema: {
     status: 404,
     msg: 'User not found.'
     }
     }
     #swagger.responses[422] = {
     description: 'Unprocessable entity.',
     schema: {
     status: 422,
     msg: 'Required fields missing.'
     }
     }
     **/
    let { email, password } = req.body;
    let user: User = res.locals.connectedUser;

    if (email && checkRequiredField ([ { type: 'mail', object: email } ])) user.email = email;
    if (password && checkRequiredField ([ {
        type: 'password',
        object: password
    } ])) user.password = createHash ('sha256').update (password).digest ('hex');

    let updatedUser = await UserRepository.save (user);

    return res.send (updatedUser);
});


userRouter.get ('/available/:email', async (req, res) => {
    /**
     * #swagger.tags = ['User']
     * #swagger.description = 'Check if an email is available.'
     * #swagger.path = '/user/available/:email'
     * #swagger.parameters['email'] = {
     *     in: 'path',
     *     description: 'Email to check',
     *     required: true,
     *     type: 'string'
     * }
     * #swagger.responses[200] = {
     *     description: 'Returns true if the email is available, false otherwise.',
     *     schema: { available: true }
     * }
     */
    const { email } = req.params;
    const existingUser = await UserRepository.findOne ({ where: { email: Equal (email) } });

    return res.send ({ available: !existingUser });
});


userRouter.post ('/login', async (req, res) => {
    /**  #swagger.tags = ['User']
     #swagger.description = 'User login.'
     #swagger.path = '/user/login'
     #swagger.parameters['body'] = {
     in: 'body',
     description: 'User login data',
     required: true,
     schema: {
     email: 'user@example.com',
     password: 'Password123'
     }
     }
     #swagger.responses[200] = {
     description: 'User login successful.',
     schema: {
     $ref: '#/definitions/User'
     }
     }
     **/

    let { email, password } = req.body;

    if (!checkRequiredField ([ { type: 'email', object: email }, password ])) {
        return res.sendStatus (422);
    }

    let connectedUser = await UserRepository.findOneOrFail ({
        where: {
            email: Equal (email),
            password: Equal (createHash ('sha256').update (password).digest ('hex')),
            isDeleted: Equal (false)
        }
    });

    return res.send ({
        ...connectedUser,
        token: generateJwt ("token", connectedUser.id),
        refreshToken: generateJwt ("refreshToken", connectedUser.id)
    });
});

userRouter.get ('/refresh-token/:refreshToken', async (req, res) => {
    /** #swagger.tags = ['User']
     #swagger.description = 'Refresh user token.'
     #swagger.path = '/user/refresh-token/{refreshToken}'
     #swagger.parameters['refreshToken'] = {
     in: 'path',
     description: 'Refresh token',
     required: true,
     type: 'string'
     }
     #swagger.responses[200] = {
     description: 'User token refreshed successfully.',
     schema: {
     $ref: '#/definitions/User'
     }
     }
     #swagger.responses[401] = {
     description: 'Unauthorized. No valid token provided.',
     schema: {
     status: 401,
     msg: 'Aucun token valide trouvé.'
     }
     }
     */
    let { refreshToken } = req.params;

    if (!refreshToken) {
        return res.sendStatus (422);
    }

    let checkToken = verifyJwt ('refreshToken', refreshToken)

    if (!checkToken) {
        return res.status (401).send (statusMsg (401, 'Aucun token valide trouvé'))
    }

    let collab = await UserRepository.findOneByOrFail ({
        id: Equal (checkToken),
        isDeleted: Equal (false)
    });

    return res.send ({
        ...collab,
        token: generateJwt ("token", collab.id),
        refreshToken: generateJwt ("refreshToken", collab.id)
    });
});

export { userRouter }
