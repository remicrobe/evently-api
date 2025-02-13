import { Server } from "socket.io";
import { verifyJwt } from "../utils/jwt/verify";
import {randomUUID} from "crypto";

export function initSocket(io: Server) {
    io.on('connection', async (socket) => {
        const { token, context } = socket.handshake.query;

        if (!token && context !== 'auth') {
            socket.disconnect();
        } else {
            let socketUser = null;

            if (token) {
                socketUser = verifyJwt("token", token);

                if (socketUser) {
                    // Déconnecter les autres sockets de l'utilisateur
                    socket.to(socketUser.toString()).disconnectSockets();

                    // Joindre l'utilisateur à sa room
                    socket.join(socketUser.toString());
                } else {
                    socket.disconnect();
                    return;
                }
            }

            if (context === 'auth') {
                const randomUuid = randomUUID()
                socket.emit('auth_uuid', { uuid: randomUuid });

                socket.join(`auth${randomUuid}`);

                setTimeout(() => {
                    socket.disconnect()
                }, 120000);
            }
        }
    });
}
