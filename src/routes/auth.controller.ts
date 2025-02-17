import express = require("express");
import * as jwt from 'jsonwebtoken'
import {ErrorHandler} from "../utils/error/error-handler";
import {JwtPayload} from "jsonwebtoken";
import {UserRepository} from "../database/repository/user.repository";
import * as googleAuth from 'google-auth-library';
import {generateJwt} from "../utils/jwt/generate";
import {Equal} from "typeorm";
import {apiTokenMiddleware} from "../middlewares/checkApiToken";
import {User} from "../database/entity/user.entity";
import {Index} from "../index";
import {checkRequiredField} from "../utils/global";
import {AppleAuthUtils} from "../utils/auth/apple/apple";

const authRouter = express.Router();

authRouter.post('/apple/', async (req, res) => {
    /*  #swagger.tags = ['Auth']
        #swagger.path = '/auth/apple/'
        #swagger.description = 'Authentification avec apple voir la réponse, si needStepTwo = true dans ce cas tu affiches une page pour demander username firstname et lastname et tu fais apple a l'autre routes avec le token que je te renvoi dans cette même routes.'
        #swagger.parameters['body'] = {
            in: 'body',
            description: 'Informations pour identifier l'utilisateur',
            required: true,
            schema: {
                identityToken: 'identityToken',
            }
        }
        #swagger.responses[200] = {
            description: 'Successful authentication',
            schema: {
                needStepTwo: 'true',
                user: {
                    $ref: '#/definitions/User'
                }
            }
        }
 */
    try {
        const {identityToken} = req.body;

        const json = jwt.decode(identityToken, {complete: true})
        const kid = json?.header?.kid
        const appleKey = await AppleAuthUtils.getAppleSignInKey(kid)
        const check = jwt.verify(identityToken, appleKey)

        if (!check) {
            return res.sendStatus(401)
        }

        let appleUser = await UserRepository.findOneBy({sub: Equal((json?.payload as JwtPayload).sub), isDeleted: Equal(false)})
        if (!appleUser) {
            appleUser = UserRepository.createUser(
                (json?.payload as JwtPayload).email ?? `${(json?.payload as JwtPayload).sub}@apple-sub.fr`,
                "apple_account",
                "apple_account",
                false
            )
        }

        if (!appleUser.sub && (json?.payload as JwtPayload).sub) {
            appleUser.sub = (json?.payload as JwtPayload).sub
        }

        appleUser = await UserRepository.save(appleUser)

        res.send({
            needStepTwo: !appleUser.isCompleted,
            user: {
                ...appleUser,
                token: generateJwt("token", appleUser.id),
                refreshToken: generateJwt("refreshToken", appleUser.id)
            }
        })
    } catch (e) {
        ErrorHandler(e, req, res);
    }
})

authRouter.post('/apple-callback/', async (req, res) => {
    /*  #swagger.tags = ['Auth']
        #swagger.path = '/auth/apple-callback/'
        #swagger.description = 'Authentification avec apple avec callback evently.'
        #swagger.responses[200] = {
            description: 'Successful authentication',
            schema: {
                needStepTwo: 'true',
                user: {
                    $ref: '#/definitions/User'
                }
            }
        }
 */
    try {
        const {code, state} = req.body;

        let idToken = await AppleAuthUtils.getIdTokenOAuth(code);
        let json = jwt.decode(idToken, { complete: true });

        let appleUser = await UserRepository.findOneBy({sub: Equal((json?.payload as JwtPayload).sub), isDeleted: Equal(false)})
        if (!appleUser) {
            appleUser = UserRepository.createUser(
                (json?.payload as JwtPayload).email ?? `${(json?.payload as JwtPayload).sub}@apple-sub.fr`,
                "apple_account",
                "apple_account",
                false
            )
        }

        if (!appleUser.sub && (json?.payload as JwtPayload).sub) {
            appleUser.sub = (json?.payload as JwtPayload).sub
        }

        appleUser = await UserRepository.save(appleUser)

        const data = {
            needStepTwo: !appleUser.isCompleted,
            user: {
                ...appleUser,
                token: generateJwt("token", appleUser.id),
                refreshToken: generateJwt("refreshToken", appleUser.id)
            }
        };

        if (state === 'web') {
            res.redirect(`${process.env.FRONT_URL}/auth?data=${btoa(JSON.stringify(data))}`)
        } else {
            res.redirect(`evently://auth?data=${JSON.stringify(data)}`)
        }

    } catch (e) {
        console.log(e)
        ErrorHandler(e, req, res);
    }
})

authRouter.post('/google/', async (req, res) => {
    /*  #swagger.tags = ['Auth']
        #swagger.path = '/auth/google/'
        #swagger.description = 'Authentification avec google voir la réponse, si needStepTwo = true dans ce cas tu affiches une page pour demander username firstname et lastname et tu fais apple a l'autre routes avec le token que je te renvoi dans cette même routes.'
        #swagger.parameters['body'] = {
            in: 'body',
            description: 'Informations pour identifier l'utilisateur',
            required: true,
            schema: {
                identityToken: 'identityToken',
            }
        }
        #swagger.responses[200] = {
            description: 'Successful authentication',
            schema: {
                needStepTwo: 'true',
                user: {
                    $ref: '#/definitions/User'
                }
            }
        }
 */
    try {
        const {identityToken} = req.body;

        const client = new googleAuth.OAuth2Client();
        const ticket = await client.verifyIdToken({
            idToken: identityToken,
            audience: [
                '1090154088660-qj3nt5c4b3316db0bcd1d166ruaqfuc7.apps.googleusercontent.com',
                '1090154088660-9houd9gk2isnkfquk1l6srfc2i8ld2aa.apps.googleusercontent.com'
            ],
        });
        const payload = ticket.getPayload();

        let googleUser = await UserRepository.findOneBy({email: payload['email'], isDeleted: Equal(false)})
        if (!googleUser) {
            googleUser = UserRepository.createUser(
                payload['email'],
                'google_account',
                "google_account",
                false
            )
        }

        googleUser = await UserRepository.save(googleUser)

        res.send({
            needStepTwo: !googleUser.isCompleted,
            user: {
                ...googleUser,
                token: generateJwt("token", googleUser.id),
                refreshToken: generateJwt("refreshToken", googleUser.id)
            }
        })
    } catch (e) {
        ErrorHandler(e, req, res);
    }
})

authRouter.get('/google-callback/', async (req, res) => {
    /*  #swagger.tags = ['Auth']
        #swagger.path = '/auth/google-callback/'
        #swagger.description = 'Authentification avec google avec callback evently.'
        #swagger.responses[200] = {
            description: 'Successful authentication',
            schema: {
                needStepTwo: 'true',
                user: {
                    $ref: '#/definitions/User'
                }
            }
        }
 */
    try {
        const {code, state} = req.query;

        const auth = new googleAuth.OAuth2Client({
            clientId: '1090154088660-9houd9gk2isnkfquk1l6srfc2i8ld2aa.apps.googleusercontent.com',
            redirectUri: process.env.AUTH_CALLBACK,
            clientSecret: process.env.EVENTLY_DESKTOP_SECRET
        });

        const token  = await auth.getToken(code as string);


        const ticket = await auth.verifyIdToken({
            idToken: token.tokens.id_token,
            audience: [
                '1090154088660-qj3nt5c4b3316db0bcd1d166ruaqfuc7.apps.googleusercontent.com',
                '1090154088660-9houd9gk2isnkfquk1l6srfc2i8ld2aa.apps.googleusercontent.com'
            ],
        });

        const payload = ticket.getPayload();

        let googleUser = await UserRepository.findOneBy({email: payload['email'], isDeleted: Equal(false)})
        if (!googleUser) {
            googleUser = UserRepository.createUser(
                payload['email'],
                'google_account',
                "google_account",
                false
            )
        }

        googleUser = await UserRepository.save(googleUser)

        const json = {
            needStepTwo: !googleUser.isCompleted,
            user: {
                ...googleUser,
                token: generateJwt("token", googleUser.id),
                refreshToken: generateJwt("refreshToken", googleUser.id)
            }
        }

        if (state === 'web') {
            res.redirect(`${process.env.FRONT_URL}/auth?data=${btoa(JSON.stringify(json))}`)
        } else {
            res.redirect(`evently://auth?data=${JSON.stringify(json)}`)
        }
    } catch (e) {
        ErrorHandler(e, req, res);
    }
})

authRouter.post('/from-provider/step-two', apiTokenMiddleware, async (req, res) => {
    /*  #swagger.tags = ['Auth']
        #swagger.path = '/auth/from-provider/step-two'
        #swagger.description = 'Seconde route une fois que tu as utilisé la première route pour utiliser un service tiers, elle attend les infos complémentaires pour que le compte soit valide'
        #swagger.parameters['body'] = {
            in: 'body',
            description: 'Informations nécessaires pour compléter le compte utilisateur',
            required: true,
            schema: {
                    username: 'johndoe123',
                    firstname: 'John',
                    lastname: 'Doe'
            }
        }
        #swagger.responses[200] = {
            description: 'Successful authentication',
            schema: {
                needStepTwo: 'true',
                user: {
                      $ref: '#/definitions/User'
                }
            }
        }
    */
    try {
        let user: User = res.locals.connectedUser;

        if (user.isCompleted) {
            return res.sendStatus(422);
        }

        let {firstname, lastname} = req.body;
        if (!checkRequiredField([firstname, lastname])) {
            return res.sendStatus(422);
        }

        user.username = `${firstname}${lastname}`.toLowerCase() + '#' + Math.floor(1000 + Math.random() * 9000);
        user.username = user.username.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        user.firstName = firstname;
        user.lastName = lastname;
        user.isCompleted = true;

        await UserRepository.save(user);

        res.send({
            needStepTwo: !user.isCompleted,
            user: {
                ...user,
                token: generateJwt("token", user.id),
                refreshToken: generateJwt("refreshToken", user.id)
            }
        });
    } catch (e) {
        ErrorHandler(e, req, res);
    }
});

authRouter.post('/socket/', apiTokenMiddleware, async (req, res) => {
    /*  #swagger.tags = ['Auth']
        #swagger.path = '/auth/socket/'
        #swagger.description = 'Authentification avec socket.'
        #swagger.parameters['body'] = {
            in: 'body',
            description: 'Informations pour identifier l'utilisateur',
            required: true,
            schema: {
                identityToken: 'identityToken',
            }
        }
        #swagger.responses[200] = {
            description: 'Successful authentication',
            schema: {
                $ref: '#/definitions/User'
            }
        }
 */
    try {
        const {identityToken} = req.body;

        let user: User = res.locals.connectedUser;

        Index.io.to(`auth${identityToken}`).emit('login', {
            jwt: generateJwt('refreshToken', user.id)
        })

        return res.sendStatus(200)
    } catch (e) {
        ErrorHandler(e, req, res);
    }
})

export {authRouter}
