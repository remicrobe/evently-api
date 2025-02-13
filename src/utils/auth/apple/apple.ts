import * as jwksClient from 'jwks-rsa'
import * as jwt from 'jsonwebtoken'
import axios from "axios";

export class AppleAuthUtils {
    static async getAppleSignInKey(kid) {
        const client = jwksClient({
            jwksUri: 'https://appleid.apple.com/auth/keys',
        });

        let key = await client.getSigningKey(kid);
        return key.getPublicKey();
    }

    static async getIdTokenOAuth (code: string) {
        const clientId = 'sementa.com.evently.website';
        const teamId = '8TMMB69WBG';
        const keyId = 'RFNQKT8ND2';

        const clientSecret = jwt.sign({}, process.env.APPLE_AUTH_KEY, {
            algorithm: 'ES256',  // La méthode de signature
            expiresIn: '180d',   // Le JWT est valide pendant 180 jours
            audience: 'https://appleid.apple.com',  // Audience pour Apple
            issuer: teamId,      // Identifiant de l'équipe
            subject: clientId,   // L'identifiant de ton application
            keyid: keyId         // ID de la clé
        })

        const response = await axios.post('https://appleid.apple.com/auth/token', {
            code: code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: process.env.AUTH_CALLBACK_APPLE,
            grant_type: 'authorization_code'
        }, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        });

        return response.data.id_token;
    }
}
