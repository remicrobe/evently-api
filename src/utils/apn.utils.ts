import * as apn from "node-apn";
import {Index} from "../index";

export class ApnUtils {
    public static sendAPNNotification(notificationType: string, eventId: number, deviceToken: string) {
        const note = new apn.Notification();
        note.expiry = Math.floor(Date.now() / 1000) + 3600; // Expire dans 1 heure
        note.badge = 3;
        note.sound = "ping.aiff";

        switch (notificationType) {
            case "event":
                note.alert = "Un évènement a été créé et vous êtes dedans !";
                note.payload = {eventId, type: "event"};
                break;
            case "event-invite":
                note.alert = "Vous avez été invité dans un évènement !";
                note.payload = {eventId, type: "event-invite"};
                break;
            case "event-update":
                note.alert = "Un évènement au quel vous appartenez a été mis a jour !";
                note.payload = {eventId, type: "event-update"};
                break;
            default:
                note.alert = "Notification";
                note.payload = {eventId, type: notificationType};
        }

        note.topic = "com.Sementa.Evently";

        Index.apns.send(note, deviceToken)
            .then(result => {
            })
            .catch(error => {
            });
    }
}