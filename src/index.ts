import * as dotenv from 'dotenv';

dotenv.config()
import * as express from 'express'
import * as cors from 'cors'
import {AppDataSource} from "./database/datasource";
import {Server} from 'socket.io';
import * as http from "http";
import * as swaggerJsonFile from "./docs/swagger_output.json"
import * as basicAuth from 'express-basic-auth'
import * as bodyParser from "body-parser"
import * as swStats from "swagger-stats";
import * as apn from "node-apn";
import {initSocket} from "./socket/initSocket";
import {authRouter} from "./routes/auth.controller";
import {userRouter} from "./routes/user.controller";
import {friendsRouter} from "./routes/friends.controller";
import {categoryRouter} from "./routes/category.controller";
import {eventRouter} from "./routes/event.controller";
import {folderRouter} from "./routes/folder.controller";
import {initJobs} from "./jobs/manager.job";
import {notificationsRouter} from "./routes/notifications.controller";
import {Provider} from "node-apn";

export class Index {
    static jwtKey = process.env.JWT_SECRET;
    static app = express();
    static apns: Provider;
    static router = express.Router()
    static server = http.createServer(Index.app); // Créez un serveur HTTP à partir de votre application Express
    static io = new Server(Index.server, {cors: {origin: '*'}}); // Créez une instance de Socket.IO attachée à votre serveur HTTP

    static globalConfig() {
        Index.app.set('trust proxy', '127.0.0.1'); // Ready to trust you're nginx proxy :))
        Index.app.disable('x-powered-by');
        Index.app.use(cors())
        Index.app.use(bodyParser.json({ limit: '10mb' })); // Pour les données JSON
        Index.app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' })); // Pour les données encodées dans l'URL
    }

    static routeConfig() {
        Index.app.use('/auth', authRouter)
        Index.app.use('/user', userRouter)
        Index.app.use('/friends-request', friendsRouter)
        Index.app.use('/categories', categoryRouter)
        Index.app.use('/events', eventRouter)
        Index.app.use('/folders', folderRouter)
        Index.app.use('/notifications', notificationsRouter)
    }

    static swaggerConfig() {
        const swaggerUi = require('swagger-ui-express')
        Index.app.use('/docs', basicAuth({
            users: { [process.env.DOC_USERNAME] : process.env.DOC_PASSWORD},
            challenge: true,
        }), swaggerUi.serve, swaggerUi.setup(swaggerJsonFile))
    }

    static statsConfig() {
        Index.app.use(swStats.getMiddleware({
            swaggerSpec:swaggerJsonFile,
            authentication: true,
            sessionMaxAge: 900,
            onAuthenticate: (req,username,password) => {
                // CAN INSERT REAL LOGIC HERE
                return((username===process.env.STATS_USERNAME) && (password===process.env.STATS_PASSWORD) );
            }
        }))
    }

    static imageFolder() {
        if (process.env.STORAGE_FOLDER) {
            Index.app.use("/image", express.static(process.env.STORAGE_FOLDER));
        } else {
            console.error("Can't store image, path not set.")
        }
    }

    static redirectConfig() {
        Index.app.use((req, res) => {
            res.redirect('https://app.evently-app.fr');
        });
    }

    static socketConfig() {
        initSocket(this.io)
    }

    static apnsConfig() {
        this.apns = new apn.Provider({
            token: {
                key: process.env.APPLE_AUTH_KEY,
                keyId: '8Q29KLD2VK',
                teamId: '8TMMB69WBG'
            },
            production: process.env.ENVIRONMENT === 'BUILD'
        });
    }

    static async databaseConfig() {
        await AppDataSource.initialize().then(async () => {
            console.log("DB Connecté")
        });
    }

    static startServer() {
        Index.server.listen(process.env.PORT, () => {
            console.log(`API démarrée sur le port ${process.env.PORT}....`);
            Index.app.emit("ready");
        });
    }

    static initJobs() {
        initJobs();
    }

    static async main() {
        Index.swaggerConfig()
        Index.statsConfig()
        Index.globalConfig()
        Index.routeConfig()
        Index.socketConfig()
        Index.imageFolder()
        Index.redirectConfig()
        Index.initJobs()
        await Index.databaseConfig()
        Index.startServer()
        Index.apnsConfig()
    }

}

Index.main() 